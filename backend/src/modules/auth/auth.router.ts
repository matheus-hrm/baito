import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { findRefreshToken, hashPassword, issueTokens, verifyPassword, type UserRole } from '../../utils/auth.js';
import { AppError } from '../../utils/errors.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

function publicUser(row: { id: string; name: string; email: string; role: UserRole }) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const exists = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(req.body.email);
    if (exists) throw new AppError('E-mail já cadastrado', 409);

    const id = randomUUID();
    sqlite
      .prepare('INSERT INTO users (id, name, email, password_hash, role, is_verified) VALUES (?, ?, ?, ?, ?, 1)')
      .run(id, req.body.name, req.body.email, await hashPassword(req.body.password), req.body.role);

    const row = sqlite
      .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
      .get(id) as { id: string; name: string; email: string; role: UserRole };
    const tokens = await issueTokens({ id: row.id, email: row.email, role: row.role });
    res.status(201).json({ data: { ...tokens, user: publicUser(row) } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const row = sqlite
      .prepare('SELECT id, name, email, role, password_hash AS passwordHash, is_active AS isActive FROM users WHERE email = ?')
      .get(req.body.email) as
      | { id: string; name: string; email: string; role: UserRole; passwordHash: string; isActive: number }
      | undefined;

    if (!row || !(await verifyPassword(req.body.password, row.passwordHash))) {
      throw new AppError('Credenciais inválidas', 401);
    }
    if (!row.isActive) throw new AppError('Usuário inativo', 403);

    const tokens = await issueTokens({ id: row.id, email: row.email, role: row.role });
    res.json({ data: { ...tokens, user: publicUser(row) } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const row = await findRefreshToken(req.body.refreshToken);
    sqlite.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    const tokens = await issueTokens({ id: row.userId, email: row.email, role: row.role });
    res.json({ data: tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', validate(logoutSchema), async (req, res, next) => {
  try {
    const row = await findRefreshToken(req.body.refreshToken);
    sqlite.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout-all', requireAuth, (req, res) => {
  const userId = getAuthUser(req).id;
  sqlite.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  res.json({ data: { ok: true } });
});

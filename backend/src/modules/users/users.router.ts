import { Router } from 'express';
import { z } from 'zod';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { hashPassword, verifyPassword } from '../../utils/auth.js';
import { AppError } from '../../utils/errors.js';

export const usersRouter = Router();

const updateMeSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  bio: z.string().max(800).trim().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  phone: z.string().max(30).trim().nullable().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72).regex(/[A-Z]/).regex(/[0-9]/),
});

function selectUserById(id: string) {
  return sqlite
    .prepare(
      `SELECT id, name, email, role, avatar_url AS avatarUrl, bio, phone,
              is_verified AS isVerified, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE id = ?`,
    )
    .get(id);
}

usersRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: selectUserById(getAuthUser(req).id) });
});

usersRouter.patch('/me', requireAuth, validate(updateMeSchema), (req, res) => {
  const user = getAuthUser(req);
  const current = selectUserById(user.id);
  if (!current) throw new AppError('Usuário não encontrado', 404);

  const body = req.body as z.infer<typeof updateMeSchema>;
  sqlite
    .prepare('UPDATE users SET name = COALESCE(?, name), bio = ?, avatar_url = ?, phone = ? WHERE id = ?')
    .run(body.name ?? null, body.bio ?? null, body.avatarUrl ?? null, body.phone ?? null, user.id);

  res.json({ data: selectUserById(user.id) });
});

usersRouter.patch('/me/password', requireAuth, validate(passwordSchema), async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const row = sqlite.prepare('SELECT password_hash AS passwordHash FROM users WHERE id = ?').get(user.id) as
      | { passwordHash: string }
      | undefined;
    if (!row || !(await verifyPassword(req.body.currentPassword, row.passwordHash))) {
      throw new AppError('Senha atual inválida', 401);
    }

    sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(req.body.newPassword), user.id);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/:id', (req, res) => {
  const row = sqlite
    .prepare(
      `SELECT u.id, u.name, u.role, u.avatar_url AS avatarUrl, u.bio,
              p.id AS providerId, p.display_name AS providerName, p.average_rating AS averageRating,
              p.total_reviews AS totalReviews
       FROM users u
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.is_active = 1`,
    )
    .get(req.params.id);
  if (!row) throw new AppError('Usuário não encontrado', 404);
  res.json({ data: row });
});

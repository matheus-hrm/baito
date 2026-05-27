import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { sqlite } from '../db/connection.js';
import { AppError } from './errors.js';

export type UserRole = 'client' | 'provider';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export function hashPassword(plain: string) {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  return bcrypt.hash(plain, rounds);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('JWT_SECRET não configurado', 500);
  return secret;
}

function refreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new AppError('JWT_REFRESH_SECRET não configurado', 500);
  return secret;
}

export function signAccessToken(user: AuthUser) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret(),
    { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyAccessToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    if (!payload.sub || !payload.email || !payload.role) throw new Error('invalid payload');
    return {
      id: String(payload.sub),
      email: String(payload.email),
      role: payload.role as UserRole,
    };
  } catch {
    throw new AppError('Token inválido ou expirado', 401);
  }
}

function refreshExpiresAt() {
  const days = Number(String(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d').replace('d', '')) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function issueTokens(user: AuthUser) {
  const refreshToken = `${randomUUID()}.${randomUUID()}`;
  const tokenHash = await bcrypt.hash(`${refreshSecret()}:${refreshToken}`, 10);

  sqlite
    .prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), user.id, tokenHash, refreshExpiresAt());

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user,
  };
}

export async function findRefreshToken(refreshToken: string) {
  const rows = sqlite
    .prepare(
      `SELECT rt.id, rt.user_id AS userId, rt.token_hash AS tokenHash, rt.expires_at AS expiresAt,
              u.email, u.role, u.is_active AS isActive
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.expires_at > datetime('now')`,
    )
    .all() as Array<{
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: string;
      email: string;
      role: UserRole;
      isActive: number;
    }>;

  for (const row of rows) {
    if (await bcrypt.compare(`${refreshSecret()}:${refreshToken}`, row.tokenHash)) {
      if (!row.isActive) throw new AppError('Usuário inativo', 403);
      return row;
    }
  }

  throw new AppError('Refresh token inválido', 401);
}

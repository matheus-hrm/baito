import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AuthUser, type UserRole } from '../utils/auth.js';
import { AppError } from '../utils/errors.js';

export type AuthedRequest = Request & { user: AuthUser };

export function getAuthUser(req: Request): AuthUser {
  const user = (req as Partial<AuthedRequest>).user;
  if (!user) throw new AppError('Autenticação necessária', 401);
  return user;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError('Token de acesso ausente', 401));
    return;
  }

  try {
    (req as AuthedRequest).user = verifyAccessToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = getAuthUser(req);
    if (roles.includes(user.role)) {
      next();
      return;
    }

    next(new AppError('Permissão insuficiente', 403));
  };
}

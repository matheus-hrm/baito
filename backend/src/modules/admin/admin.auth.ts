import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminJwtPayload {
  sub: 'admin';
  email: string;
  scope: 'admin';
  iat: number;
  exp: number;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token administrativo ausente' });
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, getJwtSecret()) as AdminJwtPayload;

    if (payload.sub !== 'admin' || payload.scope !== 'admin') {
      return res.status(403).json({ error: 'Permissão administrativa insuficiente' });
    }

    return next();
  } catch {
    return res.status(401).json({ error: 'Token administrativo inválido ou expirado' });
  }
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET não configurado');
  }

  return secret;
}

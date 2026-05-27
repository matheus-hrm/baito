import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  return res.status(500).json({
    error: 'Erro interno do servidor',
    ...(isDev ? { details: err.message, stack: err.stack } : {}),
  });
}

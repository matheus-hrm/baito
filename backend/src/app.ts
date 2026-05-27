import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { sqlite } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { authRouter } from './modules/auth/auth.router.js';
import { categoriesRouter } from './modules/categories/categories.router.js';
import { contractsRouter } from './modules/contracts/contracts.router.js';
import { listingsRouter } from './modules/listings/listings.router.js';
import { messagesRouter } from './modules/messages/messages.router.js';
import { providersRouter } from './modules/providers/providers.router.js';
import { reviewsRouter } from './modules/reviews/reviews.router.js';
import { usersRouter } from './modules/users/users.router.js';

export function createApp() {
  runMigrations();

  const app = express();
  const corsOrigins = Array.from(
    new Set([
      ...(process.env.CORS_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ]),
  );

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(apiLimiter);

  app.get('/health', (_req, res) => {
    const dbOk = sqlite.prepare('SELECT 1 AS ok').get() as { ok: number };

    res.json({
      data: {
        status: 'ok',
        database: dbOk.ok === 1 ? 'ok' : 'error',
        uptime: process.uptime(),
      },
    });
  });

  app.use('/api/admin', adminRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/listings', listingsRouter);
  app.use('/api/contracts', contractsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

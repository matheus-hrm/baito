import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from './admin.auth.js';
import { adminLoginSchema } from './admin.schema.js';
import {
  getAdminObservability,
  getAdminOverview,
  listAdminContracts,
  listAdminListings,
  listAdminProviders,
  listAdminUsers,
  loginAdmin,
} from './admin.service.js';

export const adminRouter = Router();

adminRouter.post('/login', validate(adminLoginSchema), async (req, res, next) => {
  try {
    const data = await loginAdmin(req.body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminRouter.use(requireAdmin);

adminRouter.get('/me', (_req, res) => {
  res.json({
    data: {
      email: process.env.ADMIN_EMAIL,
      scope: 'admin',
    },
  });
});

adminRouter.get('/overview', (_req, res) => {
  res.json({ data: getAdminOverview() });
});

adminRouter.get('/observability', (_req, res) => {
  res.json({ data: getAdminObservability() });
});

adminRouter.get('/users', (req, res) => {
  const result = listAdminUsers(req.query);
  res.json(result);
});

adminRouter.get('/providers', (req, res) => {
  const result = listAdminProviders(req.query);
  res.json(result);
});

adminRouter.get('/listings', (req, res) => {
  const result = listAdminListings(req.query);
  res.json(result);
});

adminRouter.get('/contracts', (req, res) => {
  const result = listAdminContracts(req.query);
  res.json(result);
});

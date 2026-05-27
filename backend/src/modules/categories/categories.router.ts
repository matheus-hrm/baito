import { Router } from 'express';
import { listCategories } from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', (_req, res) => {
  res.json({ data: listCategories() });
});

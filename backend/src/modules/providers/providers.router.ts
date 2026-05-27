import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';
import { cleanLike, parsePagination } from '../../utils/pagination.js';

export const providersRouter = Router();

const providerSchema = z.object({
  companyName: z.string().max(140).trim().nullable().optional(),
  displayName: z.string().min(2).max(140).trim(),
  description: z.string().min(20).max(1600).trim(),
  categoryId: z.string().min(1).nullable().optional(),
  location: z.string().max(120).trim().nullable().optional(),
  website: z.string().url().nullable().optional(),
});

function providerDetail(id: string) {
  return sqlite
    .prepare(
      `SELECT p.id, p.user_id AS userId, u.name AS userName, u.email AS userEmail,
              p.company_name AS companyName, p.display_name AS displayName, p.description,
              p.location, p.website, p.average_rating AS averageRating, p.total_reviews AS totalReviews,
              p.total_contracts AS totalContracts, p.is_verified AS isVerified,
              c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug, c.icon AS categoryIcon,
              p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM provider_profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
    )
    .get(id);
}

providersRouter.post('/', requireAuth, requireRole('provider'), validate(providerSchema), (req, res) => {
  const user = getAuthUser(req);
  const exists = sqlite.prepare('SELECT id FROM provider_profiles WHERE user_id = ?').get(user.id);
  if (exists) throw new AppError('Perfil de prestador já existe', 409);

  const id = randomUUID();
  sqlite
    .prepare(
      `INSERT INTO provider_profiles
       (id, user_id, company_name, display_name, description, category_id, location, website, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(
      id,
      user.id,
      req.body.companyName ?? null,
      req.body.displayName,
      req.body.description,
      req.body.categoryId ?? null,
      req.body.location ?? null,
      req.body.website ?? null,
    );
  res.status(201).json({ data: providerDetail(id) });
});

providersRouter.get('/', (req, res) => {
  const { page, perPage, offset } = parsePagination(req.query);
  const where: string[] = [];
  const params: unknown[] = [];

  if (typeof req.query.category === 'string' && req.query.category) {
    where.push('(c.slug = ? OR c.id = ?)');
    params.push(req.query.category, req.query.category);
  }
  const q = cleanLike(req.query.q);
  if (q) {
    where.push('(p.display_name LIKE ? OR p.description LIKE ? OR p.location LIKE ?)');
    params.push(q, q, q);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const data = sqlite
    .prepare(
      `SELECT p.id, p.display_name AS displayName, p.description, p.location,
              p.average_rating AS averageRating, p.total_reviews AS totalReviews,
              p.total_contracts AS totalContracts, p.is_verified AS isVerified,
              c.name AS categoryName, c.slug AS categorySlug, c.icon AS categoryIcon
       FROM provider_profiles p
       LEFT JOIN categories c ON c.id = p.category_id
       ${clause}
       ORDER BY p.average_rating DESC, p.total_reviews DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, perPage, offset);
  const total = (sqlite
    .prepare(
      `SELECT COUNT(*) AS total FROM provider_profiles p LEFT JOIN categories c ON c.id = p.category_id ${clause}`,
    )
    .get(...params) as { total: number }).total;

  res.json({ data, meta: { page, perPage, total } });
});

providersRouter.get('/me', requireAuth, requireRole('provider'), (req, res) => {
  const user = getAuthUser(req);
  const row = sqlite.prepare('SELECT id FROM provider_profiles WHERE user_id = ?').get(user.id) as { id: string } | undefined;
  if (!row) throw new AppError('Perfil de prestador não encontrado', 404);
  res.json({ data: providerDetail(row.id) });
});

providersRouter.patch('/me', requireAuth, requireRole('provider'), validate(providerSchema.partial()), (req, res) => {
  const user = getAuthUser(req);
  const row = sqlite.prepare('SELECT id FROM provider_profiles WHERE user_id = ?').get(user.id) as { id: string } | undefined;
  if (!row) throw new AppError('Perfil de prestador não encontrado', 404);

  const current = providerDetail(row.id) as {
    companyName: string | null;
    displayName: string;
    description: string;
    categoryId: string | null;
    location: string | null;
    website: string | null;
  };
  sqlite
    .prepare(
      `UPDATE provider_profiles SET company_name = ?, display_name = ?, description = ?,
       category_id = ?, location = ?, website = ? WHERE id = ?`,
    )
    .run(
      req.body.companyName ?? current.companyName,
      req.body.displayName ?? current.displayName,
      req.body.description ?? current.description,
      req.body.categoryId ?? current.categoryId,
      req.body.location ?? current.location,
      req.body.website ?? current.website,
      row.id,
    );

  res.json({ data: providerDetail(row.id) });
});

providersRouter.get('/:id', (req, res) => {
  const provider = providerDetail(req.params.id);
  if (!provider) throw new AppError('Prestador não encontrado', 404);
  const listings = sqlite
    .prepare(
      `SELECT id, title, description, price, price_type AS priceType, price_currency AS priceCurrency,
              tags, views, created_at AS createdAt
       FROM listings WHERE provider_id = ? AND status = 'active' ORDER BY created_at DESC`,
    )
    .all(req.params.id);
  const reviews = sqlite
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, u.name AS reviewerName
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       JOIN contracts ct ON ct.id = r.contract_id
       WHERE ct.provider_id = ? AND r.is_public = 1
       ORDER BY r.created_at DESC`,
    )
    .all(req.params.id);
  res.json({ data: { provider, listings, reviews } });
});

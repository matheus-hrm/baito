import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';
import { cleanLike, jsonArray, parsePagination } from '../../utils/pagination.js';

export const listingsRouter = Router();

const listingSchema = z.object({
  title: z.string().min(5).max(120).trim(),
  description: z.string().min(20).max(5000).trim(),
  categoryId: z.string().min(1).nullable().optional(),
  price: z.number().positive().nullable().optional(),
  priceType: z.enum(['fixed', 'hourly', 'daily', 'negotiable']).default('negotiable'),
  tags: z.array(z.string().max(30).trim()).max(10).default([]),
});

function listingRow(id: string) {
  const row = sqlite
    .prepare(
      `SELECT l.id, l.provider_id AS providerId, p.display_name AS providerName,
              p.average_rating AS providerRating, p.total_reviews AS providerReviews,
              p.location, l.category_id AS categoryId, c.name AS categoryName, c.slug AS categorySlug,
              c.icon AS categoryIcon, l.title, l.description, l.price, l.price_type AS priceType,
              l.price_currency AS priceCurrency, l.tags, l.status, l.views,
              l.created_at AS createdAt, l.updated_at AS updatedAt
       FROM listings l
       JOIN provider_profiles p ON p.id = l.provider_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.id = ?`,
    )
    .get(id) as (Record<string, unknown> & { tags: string | null; status: string }) | undefined;
  return row ? { ...row, tags: jsonArray(row.tags) } : undefined;
}

function providerForUser(userId: string) {
  return sqlite.prepare('SELECT id FROM provider_profiles WHERE user_id = ?').get(userId) as { id: string } | undefined;
}

listingsRouter.post('/', requireAuth, requireRole('provider'), validate(listingSchema), (req, res) => {
  const provider = providerForUser(getAuthUser(req).id);
  if (!provider) throw new AppError('Crie um perfil de prestador antes de publicar anúncios', 403);

  const id = randomUUID();
  sqlite
    .prepare(
      `INSERT INTO listings
       (id, provider_id, category_id, title, description, price, price_type, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      provider.id,
      req.body.categoryId ?? null,
      req.body.title,
      req.body.description,
      req.body.price ?? null,
      req.body.priceType,
      JSON.stringify(req.body.tags ?? []),
    );
  res.status(201).json({ data: listingRow(id) });
});

listingsRouter.get('/', (req, res) => {
  const { page, perPage, offset } = parsePagination(req.query);
  const where = ["l.status = 'active'"];
  const params: unknown[] = [];

  if (typeof req.query.category === 'string' && req.query.category) {
    where.push('(c.slug = ? OR c.id = ?)');
    params.push(req.query.category, req.query.category);
  }
  const q = cleanLike(req.query.q);
  if (q) {
    where.push('(l.title LIKE ? OR l.description LIKE ? OR p.display_name LIKE ? OR l.tags LIKE ?)');
    params.push(q, q, q, q);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const rows = sqlite
    .prepare(
      `SELECT l.id, l.provider_id AS providerId, p.display_name AS providerName,
              p.average_rating AS providerRating, p.total_reviews AS providerReviews,
              p.location, c.name AS categoryName, c.slug AS categorySlug, c.icon AS categoryIcon,
              l.title, l.description, l.price, l.price_type AS priceType,
              l.price_currency AS priceCurrency, l.tags, l.views, l.created_at AS createdAt
       FROM listings l
       JOIN provider_profiles p ON p.id = l.provider_id
       LEFT JOIN categories c ON c.id = l.category_id
       ${clause}
       ORDER BY p.average_rating DESC, l.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, perPage, offset) as Array<Record<string, unknown> & { tags: string | null }>;
  const total = (sqlite
    .prepare(
      `SELECT COUNT(*) AS total FROM listings l JOIN provider_profiles p ON p.id = l.provider_id
       LEFT JOIN categories c ON c.id = l.category_id ${clause}`,
    )
    .get(...params) as { total: number }).total;

  res.json({ data: rows.map((row) => ({ ...row, tags: jsonArray(row.tags) })), meta: { page, perPage, total } });
});

listingsRouter.get('/mine', requireAuth, requireRole('provider'), (req, res) => {
  const provider = providerForUser(getAuthUser(req).id);
  if (!provider) return res.json({ data: [] });
  const rows = sqlite
    .prepare(
      `SELECT id, title, description, price, price_type AS priceType, status, views, tags,
              created_at AS createdAt, updated_at AS updatedAt
       FROM listings WHERE provider_id = ? ORDER BY created_at DESC`,
    )
    .all(provider.id) as Array<Record<string, unknown> & { tags: string | null }>;
  res.json({ data: rows.map((row) => ({ ...row, tags: jsonArray(row.tags) })) });
});

listingsRouter.get('/:id', (req, res) => {
  sqlite.prepare('UPDATE listings SET views = views + 1 WHERE id = ? AND status = ?').run(req.params.id, 'active');
  const row = listingRow(req.params.id);
  if (!row || row.status === 'deleted') throw new AppError('Anúncio não encontrado', 404);
  res.json({ data: row });
});

listingsRouter.patch('/:id', requireAuth, requireRole('provider'), validate(listingSchema.partial()), (req, res) => {
  const provider = providerForUser(getAuthUser(req).id);
  const current = listingRow(req.params.id) as
    | {
        providerId: string;
        title: string;
        description: string;
        categoryId: string | null;
        price: number | null;
        priceType: string;
        tags: string[];
      }
    | undefined;
  if (!provider || !current || current.providerId !== provider.id) throw new AppError('Anúncio não encontrado', 404);

  sqlite
    .prepare(
      `UPDATE listings SET title = ?, description = ?, category_id = ?, price = ?, price_type = ?, tags = ?
       WHERE id = ?`,
    )
    .run(
      req.body.title ?? current.title,
      req.body.description ?? current.description,
      req.body.categoryId ?? current.categoryId,
      req.body.price ?? current.price,
      req.body.priceType ?? current.priceType,
      JSON.stringify(req.body.tags ?? current.tags),
      req.params.id,
    );
  res.json({ data: listingRow(req.params.id) });
});

listingsRouter.delete('/:id', requireAuth, requireRole('provider'), (req, res) => {
  const provider = providerForUser(getAuthUser(req).id);
  const current = listingRow(req.params.id) as { providerId: string } | undefined;
  if (!provider || !current || current.providerId !== provider.id) throw new AppError('Anúncio não encontrado', 404);
  sqlite.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(req.params.id);
  res.json({ data: { ok: true } });
});

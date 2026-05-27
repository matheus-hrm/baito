import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';

export const reviewsRouter = Router();

const reviewSchema = z.object({
  contractId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1200).trim().nullable().optional(),
});

reviewsRouter.post('/', requireAuth, requireRole('client'), validate(reviewSchema), (req, res) => {
  const user = getAuthUser(req);
  const contract = sqlite
    .prepare(
      `SELECT ct.id, ct.client_id AS clientId, p.user_id AS providerUserId, ct.status
       FROM contracts ct JOIN provider_profiles p ON p.id = ct.provider_id WHERE ct.id = ?`,
    )
    .get(req.body.contractId) as { id: string; clientId: string; providerUserId: string; status: string } | undefined;
  if (!contract || contract.clientId !== user.id) throw new AppError('Contrato não encontrado', 404);
  if (contract.status !== 'confirmed') throw new AppError('Avaliação só é permitida após conclusão confirmada', 400);

  const id = randomUUID();
  try {
    sqlite
      .prepare('INSERT INTO reviews (id, contract_id, reviewer_id, reviewed_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, contract.id, user.id, contract.providerUserId, req.body.rating, req.body.comment ?? null);
  } catch {
    throw new AppError('Este contrato já foi avaliado', 409);
  }

  const data = sqlite
    .prepare(
      `SELECT r.id, r.contract_id AS contractId, r.rating, r.comment, r.created_at AS createdAt,
              reviewer.name AS reviewerName, reviewed.name AS reviewedName
       FROM reviews r
       JOIN users reviewer ON reviewer.id = r.reviewer_id
       JOIN users reviewed ON reviewed.id = r.reviewed_id
       WHERE r.id = ?`,
    )
    .get(id);
  res.status(201).json({ data });
});

reviewsRouter.get('/provider/:providerId', (req, res) => {
  const data = sqlite
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, u.name AS reviewerName
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       JOIN contracts ct ON ct.id = r.contract_id
       WHERE ct.provider_id = ? AND r.is_public = 1
       ORDER BY r.created_at DESC`,
    )
    .all(req.params.providerId);
  res.json({ data });
});

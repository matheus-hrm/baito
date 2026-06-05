import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';
import { parsePagination } from '../../utils/pagination.js';

export const contractsRouter = Router();

const createContractSchema = z.object({
  providerId: z.string().min(1),
  listingId: z.string().min(1).nullable().optional(),
  title: z.string().min(5).max(140).trim(),
  description: z.string().max(2000).trim().nullable().optional(),
  agreedPrice: z.number().positive().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
});

const cancelSchema = z.object({ reason: z.string().min(5).max(500).trim() });

function userProviderId(userId: string) {
  return (sqlite.prepare('SELECT id FROM provider_profiles WHERE user_id = ?').get(userId) as { id: string } | undefined)?.id;
}

function contractDetail(id: string) {
  return sqlite
    .prepare(
      `SELECT ct.id, ct.client_id AS clientId, ct.provider_id AS providerId,
              provider_user.id AS providerUserId, ct.listing_id AS listingId,
              ct.title, ct.description, ct.agreed_price AS agreedPrice, ct.currency, ct.status,
              ct.cancelled_by AS cancelledBy, ct.cancel_reason AS cancelReason,
              ct.scheduled_at AS scheduledAt, ct.completed_at AS completedAt,
              ct.created_at AS createdAt, ct.updated_at AS updatedAt,
              client.name AS clientName, client.email AS clientEmail,
              p.display_name AS providerName, provider_user.email AS providerEmail,
              l.title AS listingTitle
       FROM contracts ct
       JOIN users client ON client.id = ct.client_id
       JOIN provider_profiles p ON p.id = ct.provider_id
       JOIN users provider_user ON provider_user.id = p.user_id
       LEFT JOIN listings l ON l.id = ct.listing_id
       WHERE ct.id = ?`,
    )
    .get(id);
}

function assertParty(contract: { clientId: string; providerId: string }, userId: string) {
  const providerId = userProviderId(userId);
  if (contract.clientId !== userId && contract.providerId !== providerId) {
    throw new AppError('Contrato não encontrado', 404);
  }
  return providerId;
}

contractsRouter.post('/', requireAuth, validate(createContractSchema), (req, res) => {
  const user = getAuthUser(req);
  if (user.role !== 'client') throw new AppError('Apenas clientes podem criar propostas', 403);
  const provider = sqlite.prepare('SELECT user_id AS userId FROM provider_profiles WHERE id = ?').get(req.body.providerId) as
    | { userId: string }
    | undefined;
  if (!provider) throw new AppError('Prestador não encontrado', 404);
  if (provider.userId === user.id) throw new AppError('Você não pode contratar seu próprio serviço', 400);

  const id = randomUUID();
  sqlite
    .prepare(
      `INSERT INTO contracts
       (id, client_id, provider_id, listing_id, title, description, agreed_price, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      user.id,
      req.body.providerId,
      req.body.listingId ?? null,
      req.body.title,
      req.body.description ?? null,
      req.body.agreedPrice ?? null,
      req.body.scheduledAt ?? null,
    );
  res.status(201).json({ data: contractDetail(id) });
});

contractsRouter.get('/', requireAuth, (req, res) => {
  const user = getAuthUser(req);
  const { page, perPage, offset } = parsePagination(req.query);
  const providerId = user.role === 'provider' ? userProviderId(user.id) : undefined;
  const params = user.role === 'provider' ? [providerId ?? ''] : [user.id];
  const where = user.role === 'provider' ? 'WHERE ct.provider_id = ?' : 'WHERE ct.client_id = ?';

  const data = sqlite
    .prepare(
      `SELECT ct.id, ct.title, ct.status, ct.agreed_price AS agreedPrice, ct.currency,
              ct.created_at AS createdAt, client.name AS clientName, p.display_name AS providerName,
              l.title AS listingTitle
       FROM contracts ct
       JOIN users client ON client.id = ct.client_id
       JOIN provider_profiles p ON p.id = ct.provider_id
       LEFT JOIN listings l ON l.id = ct.listing_id
       ${where}
       ORDER BY ct.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, perPage, offset);
  const total = (sqlite.prepare(`SELECT COUNT(*) AS total FROM contracts ct ${where}`).get(...params) as { total: number }).total;
  res.json({ data, meta: { page, perPage, total } });
});

contractsRouter.get('/:id', requireAuth, (req, res) => {
  const contract = contractDetail(req.params.id) as { clientId: string; providerId: string } | undefined;
  if (!contract) throw new AppError('Contrato não encontrado', 404);
  assertParty(contract, getAuthUser(req).id);
  res.json({ data: contract });
});

function transition(req: Request, res: Response, next: NextFunction, nextStatus: string) {
  try {
    const user = getAuthUser(req);
    const contract = contractDetail(req.params.id) as { id: string; clientId: string; providerId: string; status: string } | undefined;
    if (!contract) throw new AppError('Contrato não encontrado', 404);
    const providerId = assertParty(contract, user.id);

    const providerOnly = ['accepted', 'in_progress', 'completed'];
    if (providerOnly.includes(nextStatus) && contract.providerId !== providerId) throw new AppError('Apenas o prestador pode avançar este contrato', 403);
    if (nextStatus === 'confirmed' && contract.clientId !== user.id) throw new AppError('Apenas o cliente pode confirmar conclusão', 403);

    const allowed: Record<string, string[]> = {
      pending: ['accepted', 'cancelled'],
      accepted: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: ['confirmed', 'cancelled'],
    };
    if (!allowed[contract.status]?.includes(nextStatus)) throw new AppError('Transição de contrato inválida', 400);

    const completedAt = nextStatus === 'completed' || nextStatus === 'confirmed' ? new Date().toISOString() : null;
    sqlite.prepare('UPDATE contracts SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?').run(nextStatus, completedAt, contract.id);
    res.json({ data: contractDetail(contract.id) });
  } catch (err) {
    next(err);
  }
}

contractsRouter.patch('/:id/accept', requireAuth, requireRole('provider'), (req, res, next) => transition(req, res, next, 'accepted'));
contractsRouter.patch('/:id/start', requireAuth, requireRole('provider'), (req, res, next) => transition(req, res, next, 'in_progress'));
contractsRouter.patch('/:id/complete', requireAuth, requireRole('provider'), (req, res, next) => transition(req, res, next, 'completed'));
contractsRouter.patch('/:id/confirm', requireAuth, requireRole('client'), (req, res, next) => transition(req, res, next, 'confirmed'));

contractsRouter.patch('/:id/cancel', requireAuth, validate(cancelSchema), (req, res) => {
  const user = getAuthUser(req);
  const contract = contractDetail(req.params.id) as { id: string; clientId: string; providerId: string; status: string } | undefined;
  if (!contract) throw new AppError('Contrato não encontrado', 404);
  assertParty(contract, user.id);
  if (['confirmed', 'cancelled'].includes(contract.status)) throw new AppError('Contrato não pode ser cancelado neste estado', 400);

  sqlite
    .prepare("UPDATE contracts SET status = 'cancelled', cancelled_by = ?, cancel_reason = ? WHERE id = ?")
    .run(user.id, req.body.reason, contract.id);
  res.json({ data: contractDetail(contract.id) });
});

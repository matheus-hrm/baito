import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';

export const messagesRouter = Router();

const messageSchema = z.object({
  receiverId: z.string().min(1),
  contractId: z.string().min(1).nullable().optional(),
  content: z.string().min(1).max(2000).trim(),
});

messagesRouter.post('/', requireAuth, validate(messageSchema), (req, res) => {
  const user = getAuthUser(req);
  if (user.id === req.body.receiverId) throw new AppError('Não é possível enviar mensagem para si mesmo', 400);
  const receiver = sqlite.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(req.body.receiverId);
  if (!receiver) throw new AppError('Destinatário não encontrado', 404);

  if (req.body.contractId) {
    const contract = sqlite
      .prepare(
        `SELECT ct.client_id AS clientId, p.user_id AS providerUserId
         FROM contracts ct JOIN provider_profiles p ON p.id = ct.provider_id WHERE ct.id = ?`,
      )
      .get(req.body.contractId) as { clientId: string; providerUserId: string } | undefined;
    if (!contract || ![contract.clientId, contract.providerUserId].includes(user.id)) {
      throw new AppError('Contrato não encontrado', 404);
    }
  }

  const id = randomUUID();
  sqlite
    .prepare('INSERT INTO messages (id, sender_id, receiver_id, contract_id, content) VALUES (?, ?, ?, ?, ?)')
    .run(id, user.id, req.body.receiverId, req.body.contractId ?? null, req.body.content);
  const data = sqlite
    .prepare(
      `SELECT m.id, m.sender_id AS senderId, m.receiver_id AS receiverId, m.contract_id AS contractId,
              m.content, m.is_read AS isRead, m.created_at AS createdAt,
              sender.name AS senderName, receiver.name AS receiverName
       FROM messages m
       JOIN users sender ON sender.id = m.sender_id
       JOIN users receiver ON receiver.id = m.receiver_id
       WHERE m.id = ?`,
    )
    .get(id);
  res.status(201).json({ data });
});

messagesRouter.get('/conversations', requireAuth, (req, res) => {
  const user = getAuthUser(req);
  const data = sqlite
    .prepare(
      `SELECT other.id AS userId, other.name AS userName,
              MAX(m.created_at) AS lastMessageAt,
              SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END) AS unread
       FROM messages m
       JOIN users other ON other.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
       WHERE m.sender_id = ? OR m.receiver_id = ?
       GROUP BY other.id, other.name
       ORDER BY lastMessageAt DESC`,
    )
    .all(user.id, user.id, user.id, user.id);
  res.json({ data });
});

messagesRouter.get('/conversations/:userId', requireAuth, (req, res) => {
  const user = getAuthUser(req);
  const data = sqlite
    .prepare(
      `SELECT id, sender_id AS senderId, receiver_id AS receiverId, contract_id AS contractId,
              content, is_read AS isRead, read_at AS readAt, created_at AS createdAt
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
    )
    .all(user.id, req.params.userId, req.params.userId, user.id);
  res.json({ data });
});

messagesRouter.patch('/conversations/:userId/read', requireAuth, (req, res) => {
  const user = getAuthUser(req);
  sqlite
    .prepare("UPDATE messages SET is_read = 1, read_at = datetime('now') WHERE sender_id = ? AND receiver_id = ?")
    .run(req.params.userId, user.id);
  res.json({ data: { ok: true } });
});

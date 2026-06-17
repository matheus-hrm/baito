import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { sqlite } from '../../db/connection.js';
import { getAuthUser, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';

export const paymentsRouter = Router();

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set. Payment endpoints will fail.');
}

const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' }) : null;

const createPaymentIntentSchema = z.object({
  contractId: z.string().min(1),
});

function userProviderId(userId: string) {
  return (sqlite.prepare('SELECT id FROM provider_profiles WHERE user_id = ?').get(userId) as { id: string } | undefined)?.id;
}

function assertParty(contract: { clientId: string; providerId: string }, userId: string) {
  const providerId = userProviderId(userId);
  if (contract.clientId !== userId && contract.providerId !== providerId) {
    throw new AppError('Contrato não encontrado', 404);
  }
  return providerId;
}

// Create payment intent for confirmed contract
paymentsRouter.post('/payment-intent', requireAuth, validate(createPaymentIntentSchema), async (req, res) => {
  if (!stripe) throw new AppError('Stripe não configurado', 500);

  const user = getAuthUser(req);
  const contract = sqlite
    .prepare(
      `SELECT id, client_id AS clientId, provider_id AS providerId, title, agreed_price AS agreedPrice,
              currency, status FROM contracts WHERE id = ?`,
    )
    .get(req.body.contractId) as
    | { id: string; clientId: string; providerId: string; title: string; agreedPrice: number | null; currency: string; status: string }
    | undefined;

  if (!contract) throw new AppError('Contrato não encontrado', 404);
  assertParty(contract, user.id);

  if (contract.status !== 'confirmed') {
    throw new AppError('Apenas contratos confirmados podem ser pagos', 400);
  }

  if (!contract.agreedPrice || contract.agreedPrice <= 0) {
    throw new AppError('Contrato sem valor definido', 400);
  }

  // Check if payment already exists
  const existing = sqlite
    .prepare('SELECT stripe_payment_intent_id FROM payments WHERE contract_id = ?')
    .get(contract.id) as { stripe_payment_intent_id: string } | undefined;

  const frontendUrl = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim();

  if (existing) {
    if (existing.stripe_payment_intent_id.startsWith('cs_')) {
      const session = await stripe.checkout.sessions.retrieve(existing.stripe_payment_intent_id);
      if (session.url) return res.json({ data: { url: session.url } });
      // Session expired — fall through and create a new one
    }
    // Stale or expired record (old pi_ ID or expired session) — clean up and recreate
    sqlite.prepare('DELETE FROM payments WHERE contract_id = ?').run(contract.id);
  }

  const amount = Math.round(contract.agreedPrice * 100);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: contract.currency.toLowerCase(),
          product_data: { name: contract.title },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${frontendUrl}/contratos/${contract.id}?payment=success`,
    cancel_url: `${frontendUrl}/contratos/${contract.id}?payment=cancelled`,
    metadata: { contractId: contract.id, contractTitle: contract.title },
  });

  sqlite
    .prepare(
      `INSERT INTO payments (id, contract_id, stripe_payment_intent_id, amount, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(crypto.randomUUID(), contract.id, session.id, contract.agreedPrice, contract.currency, 'pending');

  res.json({ data: { url: session.url } });
});

// Webhook for Stripe events
paymentsRouter.post('/webhook', async (req, res) => {
  if (!stripe) return res.status(500).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch {
    return res.status(400).send('Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    sqlite
      .prepare('UPDATE payments SET status = ? WHERE stripe_payment_intent_id = ?')
      .run('succeeded', checkoutSession.id);
  } else if (event.type === 'checkout.session.expired') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    sqlite
      .prepare('UPDATE payments SET status = ? WHERE stripe_payment_intent_id = ?')
      .run('failed', checkoutSession.id);
  }

  res.json({ received: true });
});

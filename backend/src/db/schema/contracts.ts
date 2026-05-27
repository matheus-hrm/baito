import { sql } from 'drizzle-orm';
import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { listings } from './listings.js';
import { providerProfiles } from './providers.js';
import { users } from './users.js';

export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => users.id),
  providerId: text('provider_id').notNull().references(() => providerProfiles.id),
  listingId: text('listing_id').references(() => listings.id),
  title: text('title').notNull(),
  description: text('description'),
  agreedPrice: real('agreed_price'),
  currency: text('currency').notNull().default('BRL'),
  status: text('status', {
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'confirmed', 'cancelled', 'disputed'],
  })
    .notNull()
    .default('pending'),
  cancelledBy: text('cancelled_by'),
  cancelReason: text('cancel_reason'),
  scheduledAt: text('scheduled_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;

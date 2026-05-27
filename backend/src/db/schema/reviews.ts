import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { contracts } from './contracts.js';
import { users } from './users.js';

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  contractId: text('contract_id').notNull().unique().references(() => contracts.id),
  reviewerId: text('reviewer_id').notNull().references(() => users.id),
  reviewedId: text('reviewed_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type Review = typeof reviews.$inferSelect;

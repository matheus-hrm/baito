import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { categories } from './categories.js';
import { users } from './users.js';

export const providerProfiles = sqliteTable('provider_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name'),
  displayName: text('display_name').notNull(),
  description: text('description').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  location: text('location'),
  website: text('website'),
  cnpj: text('cnpj'),
  cpf: text('cpf'),
  averageRating: real('average_rating').default(0),
  totalReviews: integer('total_reviews').default(0),
  totalContracts: integer('total_contracts').default(0),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type NewProviderProfile = typeof providerProfiles.$inferInsert;

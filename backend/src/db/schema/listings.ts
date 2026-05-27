import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { categories } from './categories.js';
import { providerProfiles } from './providers.js';

export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => providerProfiles.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  price: real('price'),
  priceType: text('price_type', { enum: ['fixed', 'hourly', 'daily', 'negotiable'] })
    .notNull()
    .default('negotiable'),
  priceCurrency: text('price_currency').notNull().default('BRL'),
  tags: text('tags'),
  status: text('status', { enum: ['active', 'paused', 'deleted'] }).notNull().default('active'),
  views: integer('views').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const listingImages = sqliteTable('listing_images', {
  id: text('id').primaryKey(),
  listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  altText: text('alt_text'),
  order: integer('order').notNull().default(0),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

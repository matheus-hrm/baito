import { asc } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { categories } from '../../db/schema/index.js';

export function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.name)).all();
}

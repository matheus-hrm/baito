import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema/index.js';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL ?? './data/baito.db';
const databaseDir = path.dirname(databaseUrl);

if (databaseDir && databaseDir !== '.') {
  fs.mkdirSync(databaseDir, { recursive: true });
}

export const sqlite = new Database(databaseUrl);

sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');

export const db = drizzle(sqlite, { schema });

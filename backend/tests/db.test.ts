import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATABASE_URL = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baito-db-')), 'test.db');

const { sqlite } = await import('../src/db/connection.js');
const { runMigrations } = await import('../src/db/migrate.js');
const { listCategories } = await import('../src/modules/categories/categories.service.js');

runMigrations();

const categories = listCategories();
assert.equal(categories.length, 10, 'seed deve criar 10 categorias');
assert.match(categories[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

assert.throws(
  () => {
    sqlite
      .prepare(
        `INSERT INTO provider_profiles (id, user_id, display_name, description)
         VALUES ('018f6b23-7c01-7000-8000-000000009999', '018f6b23-7c01-7000-8000-000000008888', 'Teste', 'Teste')`,
      )
      .run();
  },
  /FOREIGN KEY constraint failed/,
  'foreign keys devem estar ativas no SQLite',
);

const journalMode = sqlite.pragma('journal_mode', { simple: true });
assert.equal(journalMode, 'wal', 'SQLite deve usar WAL');

console.log('DB test passed');

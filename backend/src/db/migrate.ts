import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqlite } from './connection.js';

const migrationsDir = path.resolve(process.cwd(), 'migrations');
const currentFile = fileURLToPath(import.meta.url);

export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    sqlite.prepare('SELECT id FROM migrations').all().map((row) => (row as { id: string }).id),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    sqlite.exec(sql);
    sqlite.prepare('INSERT INTO migrations (id) VALUES (?)').run(file);
    console.log(`Applied migration: ${file}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runMigrations();
}

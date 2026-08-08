import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase, type Database } from './client.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

export interface MigrationReport {
  applied: string[];
  skipped: string[];
}

/** Idempotent: applies every .sql file in order, once. */
export async function runMigrations(db: Database, log = false): Promise<MigrationReport> {
  await db.exec(TRACKING_TABLE);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  const report: MigrationReport = { applied: [], skipped: [] };

  for (const file of files) {
    if (done.has(file)) {
      report.skipped.push(file);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await db.exec(sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      report.applied.push(file);
      if (log) console.log(`  applied  ${file}`);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  if (log && report.applied.length === 0) console.log('  database already up to date');
  return report;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  console.log('RideSync — running migrations');
  const db = await getDatabase();
  await runMigrations(db, true);
  await db.close();
  console.log('Done.');
  process.exit(0);
}

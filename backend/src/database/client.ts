import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Thin persistence boundary.
 *
 * The application only ever talks to `Queryable`, and every statement is plain
 * PostgreSQL with `$n` placeholders — the same shape `pg.Pool` exposes. That
 * keeps the embedded engine (PGlite, no server/container required) swappable
 * for a real PostgreSQL cluster without touching a single query.
 */
export interface QueryResult<T> {
  rows: T[];
  affectedRows: number;
}

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Database extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

function wrap(pg: PGlite): Database {
  const runner: Database = {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pg.query<T>(sql, params as never[]);
      return { rows: result.rows as T[], affectedRows: result.affectedRows ?? 0 };
    },
    async transaction<T>(fn: (tx: Queryable) => Promise<T>) {
      return (await pg.transaction(async (tx) => {
        const scoped: Queryable = {
          async query<R>(sql: string, params: unknown[] = []) {
            const result = await tx.query<R>(sql, params as never[]);
            return { rows: result.rows as R[], affectedRows: result.affectedRows ?? 0 };
          },
        };
        return fn(scoped);
      })) as T;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
  return runner;
}

let singleton: Promise<Database> | null = null;

/** Persistent database used by the dev/demo server and the CLI scripts. */
export function getDatabase(): Promise<Database> {
  if (!singleton) {
    singleton = (async () => {
      fs.mkdirSync(path.dirname(env.databaseDir), { recursive: true });
      const pg = await PGlite.create(env.databaseDir);
      return wrap(pg);
    })();
  }
  return singleton;
}

/** Fresh in-memory database — one per test file, nothing to clean up. */
export async function createInMemoryDatabase(): Promise<Database> {
  const pg = await PGlite.create();
  return wrap(pg);
}

/* ------------------------------------------------------------------ */
/* Row coercion helpers                                                */
/* ------------------------------------------------------------------ */

/** NUMERIC/BIGINT columns can arrive as strings; normalise to a number. */
export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Round to 2 decimals — money and distance are never stored with more. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isoRequired(value: unknown): string {
  return iso(value) ?? new Date(0).toISOString();
}

export function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 't' || value === 1;
}

export function json<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

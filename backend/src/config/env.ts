import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function str(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function int(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',
  isTest: str('NODE_ENV', 'development') === 'test',
  port: int('PORT', 4000),

  /**
   * Embedded PostgreSQL (PGlite) data directory — no database server or
   * container required. Set DATABASE_URL later to point at a real cluster;
   * the SQL in src/database/migrations is standard PostgreSQL.
   */
  databaseDir: path.resolve(backendRoot, str('DATABASE_DIR', '.data/pgdata')),

  jwtSecret: str('JWT_SECRET', 'ridesync-dev-secret-change-me'),
  jwtExpiresInSeconds: int('JWT_EXPIRES_IN_SECONDS', 60 * 60 * 12),

  corsOrigins: str('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** Invitation acceptance link base (employee web app). */
  employeeAppUrl: str('EMPLOYEE_APP_URL', 'http://localhost:5175'),
} as const;

export const backendRootDir = backendRoot;

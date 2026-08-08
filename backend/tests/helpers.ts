import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createInMemoryDatabase, type Database } from '../src/database/client.js';
import { runMigrations } from '../src/database/migrate.js';
import { DEMO_PASSWORD, seedDemoData, seedSecondOrganization, type SeedResult } from '../src/database/seed.js';

export interface TestContext {
  db: Database;
  app: Express;
  demo: SeedResult;
  other: { organizationId: string; adminEmail: string };
}

/** Boots a throwaway in-memory PostgreSQL with the full demo dataset. */
export async function createTestContext(): Promise<TestContext> {
  const db = await createInMemoryDatabase();
  await runMigrations(db);
  const demo = await seedDemoData(db, { quiet: true });
  const other = await seedSecondOrganization(db);
  return { db, app: createApp(db), demo, other };
}

export async function login(app: Express, email: string, password = DEMO_PASSWORD): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.token as string;
}

export function auth(token: string): [string, string] {
  return ['authorization', `Bearer ${token}`];
}

export { DEMO_PASSWORD };

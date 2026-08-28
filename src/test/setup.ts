/**
 * Runs once per test file: migrates the test database and keeps it clean.
 *
 * `DATABASE_URL` in vitest.config.ts points at `job_hunt_test`, so `db` here is
 * the same client the app itself would use — this never touches `job_hunt`.
 */
import { afterAll, afterEach, beforeAll } from 'vitest';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './src/db/migrations' });
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE refresh_tokens, users CASCADE`);
});

afterAll(async () => {
  await pool.end();
});

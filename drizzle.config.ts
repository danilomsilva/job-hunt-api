/**
 * Configuration for `drizzle-kit` (the migration CLI).
 *
 * `drizzle-kit generate` diffs `schema` against the last snapshot in `out` and
 * writes a new SQL migration. `migrate` and `studio` additionally connect to the
 * database using `dbCredentials`.
 *
 * This file is standalone on purpose: it depends only on DATABASE_URL, not on
 * the app's full env schema, so an unrelated bad value (e.g. PORT) can't stop a
 * migration from running.
 */
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to run drizzle-kit (add it to .env)');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  // Prompt before emitting statements that could drop data.
  strict: true,
  // Print the SQL that runs.
  verbose: true,
});

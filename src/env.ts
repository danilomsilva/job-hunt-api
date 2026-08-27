/**
 * Parses and validates process environment variables exactly once.
 *
 * Import `env` anywhere you need configuration. If the environment is invalid
 * the process exits immediately — the app should never run with bad config.
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  // Required — there is no sensible default for a database connection.
  DATABASE_URL: z.string().refine(isPostgresUrl, {
    message: 'must be a PostgreSQL connection string, e.g. postgres://user:pass@host:5432/db',
  }),
});

function isPostgresUrl(value: string): boolean {
  try {
    return ['postgres:', 'postgresql:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;

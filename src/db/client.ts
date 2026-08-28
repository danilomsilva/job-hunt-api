/**
 * The single Drizzle client for the app.
 *
 * Everything that needs to talk to Postgres imports `db` from here rather than
 * creating its own pool — one pool per process, reused across requests.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

export const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });

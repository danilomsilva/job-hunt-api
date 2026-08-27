/**
 * Loads variables from a local `.env` file into `process.env`.
 *
 * This module is imported for its side effect only, and it must be the very
 * first import in the process entry point so that `.env` values are present
 * before any module reads `process.env` (notably `./env.ts`).
 */
import { config } from 'dotenv';

config({ quiet: true });

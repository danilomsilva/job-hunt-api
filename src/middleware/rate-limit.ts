/**
 * A fixed-window rate limiter, keyed by client IP by default.
 *
 * In-memory on purpose: single-process deployment target, no Redis in the
 * stack. No background sweep for stale entries either — a deliberate
 * limitation, not an oversight. This is nowhere near the traffic volume
 * where a one-visit-per-IP entry lingering in the map would matter, and
 * adding a cleanup interval now would be tuning a problem that doesn't
 * exist yet.
 */
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { TooManyRequestsError } from '../lib/errors.js';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /**
   * Defaults to the client's IP. Overridable because getConnInfo reads a
   * real Node socket — which doesn't exist under Hono's app.request() test
   * dispatch, so tests need a different key source entirely.
   */
  keyGenerator?: (c: Context) => string;
}

function defaultKeyGenerator(c: Context): string {
  return getConnInfo(c).remote.address ?? 'unknown';
}

export function rateLimit({
  windowMs,
  max,
  keyGenerator = defaultKeyGenerator,
}: RateLimitOptions): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const key = keyGenerator(c);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new TooManyRequestsError();
    }

    return next();
  };
}

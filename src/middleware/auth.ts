/**
 * Guard middleware for routes that require a signed-in user.
 *
 * Not mounted anywhere yet — Stage 4 (Applications CRUD) is the first thing that
 * needs it, for ownership checks.
 */
import type { MiddlewareHandler } from 'hono';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    throw new UnauthorizedError();
  }

  try {
    const payload = verifyAccessToken(token);
    c.set('userId', payload.sub);
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }

  await next();
};

/**
 * Access tokens are short-lived JWTs, verified by signature alone.
 *
 * Refresh tokens are opaque random strings — the raw value is only ever handed to
 * the client. The database stores just its SHA-256 hash (see `refreshTokens` in
 * `db/schema.ts`), so a leaked database dump doesn't hand out usable tokens, the
 * same way password hashes protect a leaked `users` table.
 */
import { randomBytes, createHash } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';

export interface AccessTokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new Error('Malformed access token payload');
  }
  return { sub: payload.sub };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, hash: hashRefreshToken(token) };
}

export function refreshTokenExpiresAt(): Date {
  const days = env.JWT_REFRESH_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

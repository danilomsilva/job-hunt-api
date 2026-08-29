/**
 * Auth endpoints — see docs/API.md for the contract.
 *
 * Refresh tokens are DB-backed (see db/schema.ts's `refreshTokens`) rather than a
 * second JWT, specifically so `logout` can revoke one before it expires.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users, refreshTokens } from '../db/schema.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
} from '../lib/tokens.js';
import { parseInput } from '../lib/validate.js';

const credentialsSchema = z.object({
  email: z.email(),
  // bcrypt silently truncates beyond 72 bytes — cap well under that.
  password: z.string().min(8).max(72),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const record = err as Record<string, unknown>;
  // node-postgres errors carry `code` directly; drizzle-orm wraps them in its
  // own Error with the original attached as `cause`.
  const code = record['code'] ?? pgErrorCode(record['cause']);
  return typeof code === 'string' ? code : undefined;
}

function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23505';
}

async function issueTokenPair(userId: string) {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken, hash } = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hash,
    expiresAt: refreshTokenExpiresAt(),
  });

  return { accessToken, refreshToken };
}

export const authRoutes = new Hono();

authRoutes.post('/register', async (c) => {
  const { email, password } = parseInput(credentialsSchema, await c.req.json());
  const passwordHash = await hashPassword(password);

  try {
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email, createdAt: users.createdAt });

    return c.json(user, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('An account with this email already exists');
    }
    throw err;
  }
});

authRoutes.post('/login', async (c) => {
  const { email, password } = parseInput(credentialsSchema, await c.req.json());

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const invalidCredentials = new UnauthorizedError('Invalid email or password');
  if (!user) throw invalidCredentials;

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) throw invalidCredentials;

  const tokens = await issueTokenPair(user.id);
  return c.json(tokens, 200);
});

authRoutes.post('/refresh', async (c) => {
  const { refreshToken } = parseInput(refreshSchema, await c.req.json());
  const tokenHash = hashRefreshToken(refreshToken);

  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!existing || existing.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.id, existing.id));
  const tokens = await issueTokenPair(existing.userId);
  return c.json(tokens, 200);
});

authRoutes.post('/logout', async (c) => {
  const { refreshToken } = parseInput(refreshSchema, await c.req.json());
  const tokenHash = hashRefreshToken(refreshToken);

  // Delete if present; don't reveal whether the token existed either way.
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  return c.body(null, 204);
});

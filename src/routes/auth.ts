/**
 * Auth endpoints — see docs/API.md for the contract, or /ui for interactive
 * Swagger docs generated from these same schemas.
 *
 * Refresh tokens are DB-backed (see db/schema.ts's `refreshTokens`) rather than a
 * second JWT, specifically so `logout` can revoke one before it expires.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, refreshTokens } from '../db/schema.js';
import { errorResponseSchema } from '../middleware/error-handler.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
} from '../lib/tokens.js';

const credentialsSchema = z.object({
  email: z.email().openapi({ example: 'ada@example.com' }),
  // bcrypt silently truncates beyond 72 bytes — cap well under that.
  password: z.string().min(8).max(72).openapi({ example: 'correct horse battery staple' }),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).openapi({
    example: '2215dd08daa6246ff5153f243d068cdaaf18eac9432fe654ec5946fd4085588',
  }),
});

const userResponseSchema = z.object({
  id: z.string().openapi({ example: '3dea21eb-73b2-45bc-9c2c-92347672bb2b' }),
  email: z.string().openapi({ example: 'ada@example.com' }),
  createdAt: z.string().openapi({ example: '2026-08-29T08:27:25.705Z' }),
});

const tokenPairSchema = z.object({
  accessToken: z.string().openapi({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZGVh...',
  }),
  refreshToken: z.string().openapi({
    example: 'b90c5303098e591533a527a95d80727ce5c84844d5bd9f00a77fe1b5a5ccaa3',
  }),
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

export const authRoutes = new OpenAPIHono();

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: credentialsSchema } }, required: true },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: userResponseSchema } },
      description: 'Account created',
    },
    409: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'An account with this email already exists',
    },
  },
});

authRoutes.openapi(registerRoute, async (c) => {
  const { email, password } = c.req.valid('json');
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

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: credentialsSchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: tokenPairSchema } },
      description: 'Access and refresh token pair',
    },
    401: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid email or password',
    },
  },
});

authRoutes.openapi(loginRoute, async (c) => {
  const { email, password } = c.req.valid('json');

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const invalidCredentials = new UnauthorizedError('Invalid email or password');
  if (!user) throw invalidCredentials;

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) throw invalidCredentials;

  const tokens = await issueTokenPair(user.id);
  return c.json(tokens, 200);
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: refreshSchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: tokenPairSchema } },
      description: 'A newly rotated access and refresh token pair',
    },
    401: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid or expired refresh token',
    },
  },
});

authRoutes.openapi(refreshRoute, async (c) => {
  const { refreshToken } = c.req.valid('json');
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

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: refreshSchema } }, required: true },
  },
  responses: {
    204: { description: 'Refresh token invalidated, or already gone' },
  },
});

authRoutes.openapi(logoutRoute, async (c) => {
  const { refreshToken } = c.req.valid('json');
  const tokenHash = hashRefreshToken(refreshToken);

  // Delete if present; don't reveal whether the token existed either way.
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  return c.body(null, 204);
});

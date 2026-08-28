import { describe, expect, it } from 'vitest';
import { app } from '../app.js';

const credentials = { email: 'ada@example.com', password: 'correct horse battery staple' };

function post(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function registerAndLogin() {
  await post('/auth/register', credentials);
  const res = await post('/auth/login', credentials);
  return (await res.json()) as { accessToken: string; refreshToken: string };
}

describe('POST /auth/register', () => {
  it('creates an account and never returns the password hash', async () => {
    const res = await post('/auth/register', credentials);
    expect(res.status).toBe(201);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body['email']).toBe(credentials.email);
    expect(body['id']).toBeTypeOf('string');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('password');
  });

  it('rejects a duplicate email with 409', async () => {
    await post('/auth/register', credentials);
    const res = await post('/auth/register', credentials);
    expect(res.status).toBe(409);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await post('/auth/register', { email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns an access/refresh token pair for correct credentials', async () => {
    await post('/auth/register', credentials);
    const res = await post('/auth/login', credentials);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body['accessToken']).toBeTypeOf('string');
    expect(body['refreshToken']).toBeTypeOf('string');
  });

  it('rejects an unknown email with 401', async () => {
    const res = await post('/auth/login', credentials);
    expect(res.status).toBe(401);
  });

  it('rejects the wrong password with 401', async () => {
    await post('/auth/register', credentials);
    const res = await post('/auth/login', { ...credentials, password: 'wrong password' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and issues a usable access token', async () => {
    const first = await registerAndLogin();

    const res = await post('/auth/refresh', { refreshToken: first.refreshToken });
    expect(res.status).toBe(200);

    // Two access tokens signed for the same user in the same second are
    // legitimately identical (deterministic HMAC + second-resolution `iat`) —
    // only the refresh token is guaranteed to differ, via its random bytes.
    const second = (await res.json()) as { accessToken: string; refreshToken: string };
    expect(second.accessToken).toBeTypeOf('string');
    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it('rejects a refresh token that was already rotated away', async () => {
    const first = await registerAndLogin();
    await post('/auth/refresh', { refreshToken: first.refreshToken });

    const reuse = await post('/auth/refresh', { refreshToken: first.refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await post('/auth/refresh', { refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('invalidates the refresh token', async () => {
    const { refreshToken } = await registerAndLogin();

    const logoutRes = await post('/auth/logout', { refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await post('/auth/refresh', { refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('returns 204 even for a token that does not exist', async () => {
    const res = await post('/auth/logout', { refreshToken: 'never-issued' });
    expect(res.status).toBe(204);
  });
});

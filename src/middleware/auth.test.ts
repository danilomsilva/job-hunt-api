import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { errorHandler } from './error-handler.js';
import { requireAuth } from './auth.js';
import { signAccessToken } from '../lib/tokens.js';

function buildTestApp() {
  const app = new Hono();
  app.use('*', requireAuth);
  app.get('/protected', (c) => c.json({ userId: c.get('userId') }));
  app.onError(errorHandler);
  return app;
}

describe('requireAuth', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await buildTestApp().request('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects a header that is not a Bearer token', async () => {
    const res = await buildTestApp().request('/protected', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid access token', async () => {
    const res = await buildTestApp().request('/protected', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });

  it('allows a request with a valid access token and sets userId', async () => {
    const token = signAccessToken('user-123');
    const res = await buildTestApp().request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user-123' });
  });
});

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './error-handler.js';
import { rateLimit } from './rate-limit.js';

function buildTestApp(max: number, windowMs = 60_000) {
  const app = new Hono();
  app.use(
    '*',
    rateLimit({
      windowMs,
      max,
      keyGenerator: (c) => c.req.header('x-test-client') ?? 'default',
    }),
  );
  app.get('/ping', (c) => c.text('ok'));
  app.onError(errorHandler);
  return app;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit', () => {
  it('allows exactly max requests, then blocks with 429', async () => {
    const app = buildTestApp(2);

    expect((await app.request('/ping')).status).toBe(200);
    expect((await app.request('/ping')).status).toBe(200);

    const blocked = await app.request('/ping');
    expect(blocked.status).toBe(429);

    const retryAfter = Number(blocked.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);

    const body = (await blocked.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('tracks different keys independently', async () => {
    const app = buildTestApp(1);

    expect((await app.request('/ping', { headers: { 'x-test-client': 'a' } })).status).toBe(200);
    expect((await app.request('/ping', { headers: { 'x-test-client': 'b' } })).status).toBe(200);

    expect((await app.request('/ping', { headers: { 'x-test-client': 'a' } })).status).toBe(429);
    expect((await app.request('/ping', { headers: { 'x-test-client': 'b' } })).status).toBe(429);
  });

  it('allows requests again once the window elapses', async () => {
    vi.useFakeTimers();
    const app = buildTestApp(1, 1000);

    expect((await app.request('/ping')).status).toBe(200);
    expect((await app.request('/ping')).status).toBe(429);

    vi.advanceTimersByTime(1001);

    expect((await app.request('/ping')).status).toBe(200);
  });
});

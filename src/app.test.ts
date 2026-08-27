import { describe, expect, it } from 'vitest';
import { app } from './app.js';

describe('GET /health', () => {
  it('returns 200 with a status payload', async () => {
    const res = await app.request('/health');

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });
});

describe('unknown routes', () => {
  it('return 404 in the standard error shape', async () => {
    const res = await app.request('/nope');

    expect(res.status).toBe(404);

    const body = (await res.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.requestId).toBeTypeOf('string');
  });
});

import { describe, expect, it } from 'vitest';
import { app } from '../app.js';

function request(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  return app.request(path, init);
}

let userCounter = 0;

async function createUser() {
  userCounter += 1;
  const credentials = {
    email: `user${String(userCounter)}@example.com`,
    password: 'correct horse battery staple',
  };
  await request('POST', '/auth/register', undefined, credentials);
  const res = await request('POST', '/auth/login', undefined, credentials);
  const { accessToken } = (await res.json()) as { accessToken: string };
  return accessToken;
}

const validApplication = { company: 'Acme', role: 'Backend Engineer' };

describe('applications auth guard', () => {
  it('rejects every route without a token', async () => {
    expect((await request('GET', '/applications')).status).toBe(401);
    expect((await request('POST', '/applications', undefined, validApplication)).status).toBe(401);
    expect(
      (await request('GET', '/applications/00000000-0000-0000-0000-000000000000')).status,
    ).toBe(401);
    expect(
      (await request('PATCH', '/applications/00000000-0000-0000-0000-000000000000')).status,
    ).toBe(401);
    expect(
      (await request('DELETE', '/applications/00000000-0000-0000-0000-000000000000')).status,
    ).toBe(401);
  });
});

describe('POST /applications', () => {
  it('creates an application owned by the caller', async () => {
    const token = await createUser();
    const res = await request('POST', '/applications', token, validApplication);
    expect(res.status).toBe(201);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body['company']).toBe('Acme');
    expect(body['status']).toBe('wishlist');
    expect(body['id']).toBeTypeOf('string');
  });

  it('rejects a missing company with 400', async () => {
    const token = await createUser();
    const res = await request('POST', '/applications', token, { role: 'Backend Engineer' });
    expect(res.status).toBe(400);
  });

  it('rejects salaryMin greater than salaryMax with 400', async () => {
    const token = await createUser();
    const res = await request('POST', '/applications', token, {
      ...validApplication,
      salaryMin: 200_000,
      salaryMax: 100_000,
    });
    expect(res.status).toBe(400);
  });
});

interface ListResponse {
  data: { company: string; status: string }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

describe('GET /applications', () => {
  it("only returns the caller's own applications", async () => {
    const tokenA = await createUser();
    const tokenB = await createUser();
    await request('POST', '/applications', tokenA, validApplication);
    await request('POST', '/applications', tokenB, { company: 'Other Co', role: 'Designer' });

    const res = await request('GET', '/applications', tokenA);
    const body = (await res.json()) as ListResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.company).toBe('Acme');
  });

  it('filters by status', async () => {
    const token = await createUser();
    await request('POST', '/applications', token, validApplication);
    const applied = (await (
      await request('POST', '/applications', token, { company: 'Beta', role: 'SRE' })
    ).json()) as { id: string };
    await request('PATCH', `/applications/${applied.id}`, token, { status: 'applied' });

    const res = await request('GET', '/applications?status=applied', token);
    const body = (await res.json()) as ListResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.company).toBe('Beta');
  });

  it('filters by company, case-insensitively and partially', async () => {
    const token = await createUser();
    await request('POST', '/applications', token, { company: 'Acme Corp', role: 'Engineer' });
    await request('POST', '/applications', token, { company: 'Other Co', role: 'Designer' });

    const res = await request('GET', '/applications?company=acme', token);
    const body = (await res.json()) as ListResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.company).toBe('Acme Corp');
  });

  it('sorts by the requested column and direction', async () => {
    const token = await createUser();
    await request('POST', '/applications', token, { company: 'Zeta', role: 'Engineer' });
    await request('POST', '/applications', token, { company: 'Alpha', role: 'Engineer' });

    const res = await request('GET', '/applications?sortBy=company&sortOrder=asc', token);
    const body = (await res.json()) as ListResponse;
    expect(body.data.map((a) => a.company)).toEqual(['Alpha', 'Zeta']);
  });

  it('paginates and reports accurate totals', async () => {
    const token = await createUser();
    await request('POST', '/applications', token, { company: 'One', role: 'Engineer' });
    await request('POST', '/applications', token, { company: 'Two', role: 'Engineer' });

    const res = await request('GET', '/applications?pageSize=1&page=2', token);
    const body = (await res.json()) as ListResponse;
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });

  it('rejects an invalid query value with 400', async () => {
    const token = await createUser();
    expect((await request('GET', '/applications?status=bogus', token)).status).toBe(400);
    expect((await request('GET', '/applications?pageSize=101', token)).status).toBe(400);
  });
});

describe('GET /applications/:id', () => {
  it('returns the application for its owner', async () => {
    const token = await createUser();
    const created = (await (
      await request('POST', '/applications', token, validApplication)
    ).json()) as {
      id: string;
    };

    const res = await request('GET', `/applications/${created.id}`, token);
    expect(res.status).toBe(200);
  });

  it("returns 404 for another user's application", async () => {
    const tokenA = await createUser();
    const tokenB = await createUser();
    const created = (await (
      await request('POST', '/applications', tokenA, validApplication)
    ).json()) as {
      id: string;
    };

    const res = await request('GET', `/applications/${created.id}`, tokenB);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const token = await createUser();
    const res = await request('GET', '/applications/00000000-0000-0000-0000-000000000000', token);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a malformed id', async () => {
    const token = await createUser();
    const res = await request('GET', '/applications/not-a-uuid', token);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /applications/:id', () => {
  it('updates the provided fields', async () => {
    const token = await createUser();
    const created = (await (
      await request('POST', '/applications', token, validApplication)
    ).json()) as {
      id: string;
    };

    const res = await request('PATCH', `/applications/${created.id}`, token, {
      status: 'applied',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('applied');
  });

  it('rejects an empty body with 400', async () => {
    const token = await createUser();
    const created = (await (
      await request('POST', '/applications', token, validApplication)
    ).json()) as {
      id: string;
    };

    const res = await request('PATCH', `/applications/${created.id}`, token, {});
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's application and does not modify it", async () => {
    const tokenA = await createUser();
    const tokenB = await createUser();
    const created = (await (
      await request('POST', '/applications', tokenA, validApplication)
    ).json()) as {
      id: string;
    };

    const patchRes = await request('PATCH', `/applications/${created.id}`, tokenB, {
      status: 'rejected',
    });
    expect(patchRes.status).toBe(404);

    const getRes = await request('GET', `/applications/${created.id}`, tokenA);
    const body = (await getRes.json()) as { status: string };
    expect(body.status).toBe('wishlist');
  });
});

describe('DELETE /applications/:id', () => {
  it('deletes the application', async () => {
    const token = await createUser();
    const created = (await (
      await request('POST', '/applications', token, validApplication)
    ).json()) as {
      id: string;
    };

    const deleteRes = await request('DELETE', `/applications/${created.id}`, token);
    expect(deleteRes.status).toBe(204);

    const getRes = await request('GET', `/applications/${created.id}`, token);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for another user's application and does not delete it", async () => {
    const tokenA = await createUser();
    const tokenB = await createUser();
    const created = (await (
      await request('POST', '/applications', tokenA, validApplication)
    ).json()) as {
      id: string;
    };

    const deleteRes = await request('DELETE', `/applications/${created.id}`, tokenB);
    expect(deleteRes.status).toBe(404);

    const getRes = await request('GET', `/applications/${created.id}`, tokenA);
    expect(getRes.status).toBe(200);
  });
});

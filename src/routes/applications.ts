/**
 * Applications CRUD — see docs/API.md for the contract.
 *
 * Every route requires a signed-in user (requireAuth), and list/create are
 * both scoped to that user via userId from the access token.
 */
import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { applicationStatus, applications } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';

const applicationFields = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  status: z.enum(applicationStatus.enumValues),
  location: z.string().min(1).nullish(),
  jobUrl: z.url().nullish(),
  salaryMin: z.number().int().nonnegative().nullish(),
  salaryMax: z.number().int().nonnegative().nullish(),
  salaryCurrency: z.string().length(3).nullish(),
  notes: z.string().nullish(),
  appliedAt: z.coerce.date().nullish(),
});

function salaryRangeValid(v: {
  salaryMin?: number | null | undefined;
  salaryMax?: number | null | undefined;
}): boolean {
  return v.salaryMin == null || v.salaryMax == null || v.salaryMin <= v.salaryMax;
}

const salaryRangeIssue = {
  message: 'salaryMin must not be greater than salaryMax',
  path: ['salaryMin'],
};

// The default only belongs on create — applying it on the shared field set
// would make .partial() fill in `status` on an empty update body, defeating
// the "at least one field" check below.
const createApplicationSchema = applicationFields
  .extend({ status: z.enum(applicationStatus.enumValues).default('wishlist') })
  .refine(salaryRangeValid, salaryRangeIssue);

const updateApplicationSchema = applicationFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' })
  .refine(salaryRangeValid, salaryRangeIssue);

function parseId(id: string): string {
  if (!z.uuid().safeParse(id).success) {
    throw new NotFoundError('Application not found');
  }
  return id;
}

/**
 * A nonexistent id and another user's application both return 404 — cross-
 * user access shouldn't be distinguishable from "doesn't exist", the same way
 * login's 401 doesn't distinguish a bad email from a bad password.
 */
async function findOwned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);

  if (!row) throw new NotFoundError('Application not found');
  return row;
}

export const applicationsRoutes = new Hono();

applicationsRoutes.use('*', requireAuth);

applicationsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt));

  return c.json(rows);
});

applicationsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const data = parseBody(createApplicationSchema, await c.req.json());

  const [row] = await db
    .insert(applications)
    .values({ ...data, userId })
    .returning();

  return c.json(row, 201);
});

applicationsRoutes.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const row = await findOwned(id, c.get('userId'));
  return c.json(row);
});

applicationsRoutes.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const userId = c.get('userId');
  await findOwned(id, userId);

  const data = parseBody(updateApplicationSchema, await c.req.json());
  const [row] = await db.update(applications).set(data).where(eq(applications.id, id)).returning();

  return c.json(row);
});

applicationsRoutes.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const userId = c.get('userId');
  await findOwned(id, userId);

  await db.delete(applications).where(eq(applications.id, id));
  return c.body(null, 204);
});

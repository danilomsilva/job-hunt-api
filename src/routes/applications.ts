/**
 * Applications CRUD — see docs/API.md for the contract.
 *
 * Every route requires a signed-in user (requireAuth), and list/create are
 * both scoped to that user via userId from the access token.
 */
import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { applicationStatus, applications } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';

const applicationFields = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  status: z.enum(applicationStatus.enumValues).default('wishlist'),
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

const createApplicationSchema = applicationFields.refine(salaryRangeValid, salaryRangeIssue);

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

/**
 * Applications CRUD — see docs/API.md for the contract.
 *
 * Every route requires a signed-in user (requireAuth), and list/create are
 * both scoped to that user via userId from the access token.
 */
import { Hono } from 'hono';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { applicationStatus, applications } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { parseInput } from '../lib/validate.js';

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

const listQuerySchema = z.object({
  status: z.enum(applicationStatus.enumValues).optional(),
  company: z.string().min(1).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'appliedAt', 'company']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const sortColumns = {
  createdAt: applications.createdAt,
  updatedAt: applications.updatedAt,
  appliedAt: applications.appliedAt,
  company: applications.company,
};

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
  const query = parseInput(listQuerySchema, c.req.query());

  const conditions = [eq(applications.userId, userId)];
  if (query.status) conditions.push(eq(applications.status, query.status));
  if (query.company) conditions.push(ilike(applications.company, `%${query.company}%`));
  const where = and(...conditions);

  const column = sortColumns[query.sortBy];
  const orderBy = query.sortOrder === 'asc' ? asc(column) : desc(column);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(applications)
      .where(where)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(applications).where(where),
  ]);

  const total = totalRow?.total ?? 0;

  return c.json({
    data: rows,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  });
});

applicationsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const data = parseInput(createApplicationSchema, await c.req.json());

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

  const data = parseInput(updateApplicationSchema, await c.req.json());
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

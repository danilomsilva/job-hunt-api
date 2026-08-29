/**
 * Applications CRUD — see docs/API.md for the contract, or /ui for interactive
 * Swagger docs generated from these same schemas.
 *
 * Every route requires a signed-in user (requireAuth), and list/create are
 * both scoped to that user via userId from the access token.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../db/client.js';
import { applicationStatus, applications } from '../db/schema.js';
import { errorResponseSchema } from '../middleware/error-handler.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

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

const applicationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  company: z.string(),
  role: z.string(),
  status: z.enum(applicationStatus.enumValues),
  location: z.string().nullable(),
  jobUrl: z.string().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryCurrency: z.string().nullable(),
  notes: z.string().nullable(),
  appliedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const listApplicationsResponseSchema = z.object({
  data: z.array(applicationResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

// The `id` param is deliberately a plain string, not z.string().uuid() —
// tightening it here would make zod-openapi reject a malformed id with its
// own 400 before the handler runs. The existing, tested behavior is 404 for
// a malformed id (same as a nonexistent one), via parseId() below.
const idParamSchema = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: '00000000-0000-0000-0000-000000000000',
  }),
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

export const applicationsRoutes = new OpenAPIHono();

applicationsRoutes.use('*', requireAuth);

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Applications'],
  security: [{ Bearer: [] }],
  request: { query: listQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: listApplicationsResponseSchema } },
      description: "The caller's applications, filtered/sorted/paginated",
    },
  },
});

applicationsRoutes.openapi(listRoute, async (c) => {
  const userId = c.get('userId');
  const query = c.req.valid('query');

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

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Applications'],
  security: [{ Bearer: [] }],
  request: {
    body: { content: { 'application/json': { schema: createApplicationSchema } }, required: true },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: applicationResponseSchema } },
      description: 'Application created',
    },
  },
});

applicationsRoutes.openapi(createRouteDef, async (c) => {
  const userId = c.get('userId');
  const data = c.req.valid('json');

  const [row] = await db
    .insert(applications)
    .values({ ...data, userId })
    .returning();

  return c.json(row, 201);
});

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Applications'],
  security: [{ Bearer: [] }],
  request: { params: idParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: applicationResponseSchema } },
      description: 'The application',
    },
    404: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Not found, or not owned by you',
    },
  },
});

applicationsRoutes.openapi(getRoute, async (c) => {
  const id = parseId(c.req.valid('param').id);
  const row = await findOwned(id, c.get('userId'));
  return c.json(row, 200);
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Applications'],
  security: [{ Bearer: [] }],
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: updateApplicationSchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: applicationResponseSchema } },
      description: 'Application updated',
    },
    404: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Not found, or not owned by you',
    },
  },
});

applicationsRoutes.openapi(updateRoute, async (c) => {
  const id = parseId(c.req.valid('param').id);
  const userId = c.get('userId');
  await findOwned(id, userId);

  const data = c.req.valid('json');
  const [row] = await db.update(applications).set(data).where(eq(applications.id, id)).returning();

  return c.json(row, 200);
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Applications'],
  security: [{ Bearer: [] }],
  request: { params: idParamSchema },
  responses: {
    204: { description: 'Application deleted' },
    404: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Not found, or not owned by you',
    },
  },
});

applicationsRoutes.openapi(deleteRoute, async (c) => {
  const id = parseId(c.req.valid('param').id);
  const userId = c.get('userId');
  await findOwned(id, userId);

  await db.delete(applications).where(eq(applications.id, id));
  return c.body(null, 204);
});

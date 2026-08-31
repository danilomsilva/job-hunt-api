# job-hunt-api

[![CI](https://github.com/danilomsilva/job-hunt-api/actions/workflows/ci.yml/badge.svg)](https://github.com/danilomsilva/job-hunt-api/actions/workflows/ci.yml)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-49%20passing-brightgreen)
![OpenAPI](https://img.shields.io/badge/docs-OpenAPI-6BA539?logo=openapiinitiative&logoColor=white)

A REST API for tracking job applications through the hiring pipeline — auth with
rotating/revocable refresh tokens, ownership-scoped CRUD, filtering/sorting/pagination,
rate limiting, and an OpenAPI spec generated directly from the same Zod schemas that
validate every request.

Built as a from-scratch backend exercise: no BaaS, no ORM magic hidden behind a CLI —
Node.js, TypeScript (strict), Hono, PostgreSQL, and Drizzle, held to the same standards
(typed, tested, documented, consistently error-handled) as a production service, even
though it's intentionally kept running locally rather than deployed (see
[Engineering decisions](#engineering-decisions)).

## Tech stack

| Layer            | Choice                              | Why                                                                            |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| Runtime          | Node.js 24, TypeScript strict       | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any`, ever       |
| Framework        | [Hono](https://hono.dev)            | Lightweight, runtime-agnostic (Node here, via `@hono/node-server`)             |
| Database         | PostgreSQL 16                       | Local via Docker Compose                                                       |
| ORM              | [Drizzle](https://orm.drizzle.team) | Schema-as-TypeScript, SQL-shaped query builder, generated migrations           |
| Validation       | [Zod](https://zod.dev) v4           | Every request body/query/param — the same schemas double as the OpenAPI source |
| API docs         | `@hono/zod-openapi` + Swagger UI    | Generated from the validation schemas, so the docs can't drift from reality    |
| Auth             | JWT (access) + DB-backed (refresh)  | See [Auth model](#auth-model) below                                            |
| Password hashing | bcryptjs                            | Pure JS — no native build toolchain required                                   |
| Testing          | Vitest                              | Unit tests + integration tests against a real Postgres instance, not mocks     |
| CI               | GitHub Actions                      | Lint, format, typecheck, test (real Postgres service), build — on every push   |

## Features

- **Auth** — register, login, refresh, logout. Passwords hashed with bcrypt; access
  tokens are short-lived signed JWTs; refresh tokens are opaque random strings, stored
  only as a SHA-256 hash, rotated on every use, and immediately revocable (`logout`
  deletes the row — something a stateless JWT refresh token can't offer).
- **Applications CRUD** — all five endpoints, every one scoped to the authenticated
  user. A nonexistent id and another user's application both return the same `404` —
  cross-user access is indistinguishable from "doesn't exist," so a client can't use
  status codes to enumerate other users' data.
- **Filtering, sorting, pagination** on the list endpoint — by status and company,
  four sortable columns, page/pageSize with a real `total`/`totalPages` count.
- **Rate limiting** — a small hand-rolled fixed-window limiter (see
  [Engineering decisions](#engineering-decisions) for why not a dependency), with a
  stricter bucket on `/auth/*` specifically against brute-force login attempts.
- **One error shape, everywhere** — a typed `AppError` hierarchy (`ValidationError`,
  `UnauthorizedError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`, …)
  funnels through a single handler into `{ error: { code, message, details? },
requestId }`, whether the failure came from Zod, Drizzle, or application logic.
- **Interactive API docs** — every endpoint is documented and callable from a browser
  at `/ui` (Swagger UI), including an **Authorize** button for the protected routes.
  The spec is generated from the exact Zod schemas that validate real requests, not a
  hand-maintained description of them.
- **Dockerized** — Postgres for local dev, and the app itself has a multi-stage
  `Dockerfile` too (opt-in, doesn't interfere with the hot-reloading dev workflow —
  see [Docker](#docker)).
- **CI on every push** — lint, format check, typecheck, the full test suite against a
  real Postgres service container, and a production build.

## Auth model

```text
register ──▶ login ──▶ [access token, 15 min] ──▶ protected routes
               │
               └──▶ [refresh token, 30 days, hashed in DB]
                          │
                          ├──▶ POST /auth/refresh  → rotates: new pair, old token dead
                          └──▶ POST /auth/logout   → deletes the row, revoked immediately
```

Access tokens are stateless JWTs — cheap to verify, impossible to revoke early, so
they're kept short-lived on purpose. Refresh tokens are the opposite trade-off:
long-lived, but stored (hashed) specifically so they _can_ be revoked. Reusing a
refresh token after it's been rotated away returns `401` — rotation makes token theft
self-limiting even if a refresh token leaks.

## API documentation

Full contract: [`docs/API.md`](docs/API.md). While the server is running:

| URL       | What it is                                  |
| --------- | ------------------------------------------- |
| `/ui`     | Swagger UI — browse and call every endpoint |
| `/doc`    | The raw generated OpenAPI 3.0 JSON          |
| `/health` | Liveness check                              |

| Method & path              | Auth | Description                                 |
| -------------------------- | ---- | ------------------------------------------- |
| `POST /auth/register`      | —    | Create an account                           |
| `POST /auth/login`         | —    | Returns an access/refresh token pair        |
| `POST /auth/refresh`       | —    | Rotates the refresh token, new access token |
| `POST /auth/logout`        | —    | Revokes the refresh token                   |
| `GET /applications`        | ✅   | List, filter, sort, paginate                |
| `POST /applications`       | ✅   | Create                                      |
| `GET /applications/:id`    | ✅   | Fetch one (own resources only)              |
| `PATCH /applications/:id`  | ✅   | Partial update                              |
| `DELETE /applications/:id` | ✅   | Delete                                      |

## Getting started

**Prerequisites:** Node.js 24+ (`.nvmrc` pins it), npm 10+, Docker Desktop.

```bash
npm install
cp .env.example .env              # then set JWT_SECRET — see the file for how
docker compose up -d              # PostgreSQL 16
npm run db:migrate
npm run dev
```

```bash
curl http://localhost:3000/health
# { "status": "ok", "timestamp": "..." }
```

Then open `http://localhost:3000/ui` to explore and call every endpoint interactively.

## Database

Schema lives in [`src/db/schema.ts`](src/db/schema.ts) — three tables: `users`,
`applications` (FK to `users`, cascading delete), and `refresh_tokens` (FK to `users`,
cascading delete). Migrations are generated from the schema, never hand-written:

```bash
npm run db:generate    # diff schema.ts against the last migration, write SQL
npm run db:migrate     # apply pending migrations
npm run db:studio      # Drizzle Studio — a GUI to browse/edit tables in the browser
```

Two databases: `job_hunt` (dev) and `job_hunt_test` (integration tests), both created
automatically the first time the Postgres container's data volume is created (see
`docker/postgres/init/`).

## Testing

```bash
npm test
```

**49 tests across 7 files**, all passing in CI on every push. Deliberately not mocked —
integration tests run against a real Postgres instance (`job_hunt_test`), migrated
fresh before each run, exercising real inserts, real constraint violations, and real
transactions rather than a mocked query builder that could pass while the real SQL
fails. Coverage includes:

- Unit tests for pure logic — password hashing, JWT signing/verification, refresh
  token hashing
- The auth guard middleware, in isolation
- The rate limiter — window expiry, per-key isolation — using fake timers, not real
  sleeps
- Full auth and applications integration flows, including the ownership boundary
  (a second user must get `404`, not the real data, on every id-based route) and
  input-validation edge cases (malformed ids, invalid enum values, out-of-range
  pagination)

## Docker

Two independent, opt-in-separable services in `docker-compose.yml`:

- **`postgres`** (default) — `docker compose up -d`. This is the normal dev database.
- **`app`** (opt-in, `profiles: [app]`) — the API itself, built from a multi-stage
  `Dockerfile`: a `builder` stage with full devDependencies compiles TypeScript, a slim
  `runtime` stage ships only production dependencies and the compiled output. Start it
  with `docker compose --profile app up -d --build`; it listens on `:3001` (not `:3000`)
  specifically so it can run alongside `npm run dev` without a port conflict. A plain
  `docker compose up -d` never starts it — it exists to prove the app is genuinely
  containerizable and to practice the mechanics (container-to-container networking by
  service name, not `localhost`), not to replace the hot-reloading dev loop.

## Project structure

```text
src/
├── index.ts, load-env.ts, env.ts   Entry point, .env loading, Zod-validated config
├── app.ts                          Builds the Hono app: middleware, routes, error handling
├── db/
│   ├── schema.ts                   Drizzle schema — source of truth for the database
│   ├── client.ts                   The one Postgres pool/Drizzle instance
│   └── migrations/                 Generated SQL migrations
├── routes/
│   ├── auth.ts                     register / login / refresh / logout
│   └── applications.ts             CRUD + filtering/sorting/pagination
├── middleware/
│   ├── auth.ts                     requireAuth guard (Bearer token → userId)
│   ├── rate-limit.ts                Fixed-window limiter
│   └── error-handler.ts            AppError → consistent JSON response
├── lib/
│   ├── errors.ts                   Typed AppError hierarchy
│   ├── password.ts                 bcrypt hash/verify
│   └── tokens.ts                   JWT + refresh token generation/hashing
└── test/setup.ts                    Test DB migration + per-test cleanup
```

## Engineering decisions

Judgment calls made along the way, and why:

- **Drizzle over Prisma** — closer to raw SQL, no codegen step; the goal was learning
  SQL through the ORM, not learning an abstraction over it.
- **DB-backed refresh tokens over stateless JWT refresh** — the only way to make
  `logout` actually revoke something before it expires.
- **Ownership check returns `404`, not `403`** — a `403` confirms the resource exists;
  `404` doesn't. Same principle as `login`'s single "invalid email or password"
  message for both a bad email and a bad password.
- **Hand-rolled rate limiter over a dependency** — the obvious npm option was
  explicitly "still in development"; a fixed-window limiter is small and
  well-understood enough that a young dependency wasn't worth the risk for it.
- **OpenAPI generated from Zod, not hand-written** — `docs/API.md` is maintained by
  hand and has already drifted from reality once; a spec generated from the same
  schemas that validate real requests structurally can't.
- **Not deployed** — checked Railway, Fly.io, and Render's actual current free-tier
  terms before deciding; full reasoning in [`docs/ROADMAP.md`](docs/ROADMAP.md#deployment-decision).
  The app itself is fully containerized (see [Docker](#docker)) — what was declined is
  hosting it somewhere, not building it as a deployable artifact. The strategy that
  _would_ be followed if it were ever hosted is written up in
  [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Scripts

| Script                 | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the server with hot reload (`tsx watch`) |
| `npm run build`        | Type-check and compile to `dist/`              |
| `npm start`            | Run the compiled server from `dist/`           |
| `npm run typecheck`    | Type-check the whole project, no emit          |
| `npm run lint`         | ESLint (type-aware, strict ruleset)            |
| `npm run lint:fix`     | ESLint with autofix                            |
| `npm run format`       | Format with Prettier                           |
| `npm run format:check` | Verify formatting (used in CI)                 |
| `npm test`             | Run the test suite once (Vitest)               |
| `npm run test:watch`   | Run tests in watch mode                        |
| `npm run db:generate`  | Generate a migration from `schema.ts`          |
| `npm run db:migrate`   | Apply pending migrations                       |
| `npm run db:studio`    | Drizzle Studio — browse the database in a GUI  |

## Conventions

- **TypeScript strict mode**, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. No `any`.
- **ESM with `NodeNext`** — relative imports carry a `.js` extension, matching how
  Node resolves the compiled output.
- **Zod** validates every request body, query, and param — and generates the OpenAPI
  spec from the same schemas.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`).
- Every error leaves the API as `{ error: { code, message, details? }, requestId }`.

---

Learning project background, phased roadmap, and full domain model:
[`docs/ROADMAP.md`](docs/ROADMAP.md) · [`docs/API.md`](docs/API.md) ·
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

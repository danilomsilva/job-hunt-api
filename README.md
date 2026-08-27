# job-hunt-api

A RESTful API for tracking job applications through the hiring process, built with
Node.js, TypeScript, Hono, PostgreSQL, and Drizzle ORM.

This is a learning project — see [`docs/ROADMAP.md`](docs/ROADMAP.md) for the plan
and [`docs/API.md`](docs/API.md) for the domain model and endpoint contracts.

## Prerequisites

- **Node.js 24+** (`.nvmrc` pins the major version — run `nvm use`)
- npm 10+
- **Docker** (Docker Desktop on Windows/macOS) for the local PostgreSQL container

## Getting started

```bash
npm install
cp .env.example .env
docker compose up -d       # start PostgreSQL 16
npm run dev
```

## Database

A local PostgreSQL 16 runs in Docker (see `docker-compose.yml`).

```bash
docker compose up -d       # start in the background
docker compose down        # stop, keep data
docker compose down -v     # stop and wipe the data volume
```

On first start it creates two databases: `job_hunt` (development) and
`job_hunt_test` (used by the integration tests). The connection string lives in
`.env` as `DATABASE_URL`.

The server starts on `http://localhost:3000`. Check it:

```bash
curl http://localhost:3000/health
# { "status": "ok", "timestamp": "..." }
```

## Scripts

| Script                 | What it does                                       |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Start the server with hot reload (`tsx watch`)     |
| `npm run build`        | Type-check and compile to `dist/` (excludes tests) |
| `npm start`            | Run the compiled server from `dist/`               |
| `npm run typecheck`    | Type-check the whole project, no emit              |
| `npm run lint`         | ESLint (type-aware, `strict` ruleset)              |
| `npm run lint:fix`     | ESLint with autofix                                |
| `npm run format`       | Format with Prettier                               |
| `npm run format:check` | Verify formatting (used in CI)                     |
| `npm test`             | Run the test suite once (Vitest)                   |
| `npm run test:watch`   | Run tests in watch mode                            |

## Project structure

```
src/
├── index.ts                  Entry point — loads env, starts the HTTP server
├── load-env.ts               Side-effect import that populates process.env from .env
├── env.ts                    Zod-validated, typed configuration
├── app.ts                    Builds the Hono app (middleware + routes + handlers)
├── app.test.ts               Integration tests for the base app
├── lib/
│   └── errors.ts             Typed AppError classes → consistent error responses
└── middleware/
    └── error-handler.ts      Central error + not-found handlers
```

Feature modules (`src/modules/auth`, `src/modules/applications`, …) are added as
the roadmap progresses. Each module owns its routes, service logic, Zod schemas,
and tests.

## Conventions

- **TypeScript strict mode**, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. No `any`.
- **ESM with `NodeNext`** — relative imports carry a `.js` extension, matching how
  Node resolves the compiled output.
- **Zod** validates every request body and the environment.
- **Conventional Commits** for commit messages (`feat:`, `fix:`, `docs:`, …).
- Every error leaves the API as `{ error: { code, message, details? }, requestId }`.

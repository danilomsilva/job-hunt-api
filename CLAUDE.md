# job-hunt-api

A RESTful API for tracking job applications, built with Node.js, TypeScript, and PostgreSQL.
This is a learning project — the goal is a production-quality backend built from scratch.

> Planning and specs live in [`docs/`](docs/): see [`docs/ROADMAP.md`](docs/ROADMAP.md)
> for the learning roadmap and timeline, and [`docs/API.md`](docs/API.md) for the
> domain model and API contracts.

## Tech stack

- **Runtime:** Node.js with TypeScript (strict mode)
- **Framework:** Hono — TypeScript-native, lightweight, excellent DX
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM — TypeScript-native, close to raw SQL, great for learning
- **Auth:** JWT (access token + refresh token pattern) + bcrypt
- **Validation:** Zod on every endpoint
- **Testing:** Vitest + supertest
- **Linting:** ESLint + Prettier
- **Deployment:** none — decided to keep this running locally only (see `docs/ROADMAP.md`)

## Code standards

- TypeScript strict mode — no `any`, no shortcuts
- Every route must have proper error handling and a consistent error response shape
- Zod for request validation on all endpoints
- Environment variables via dotenv — never hardcode secrets
- Follow RESTful conventions strictly — resource naming, status codes, error shapes, pagination
- Write integration tests for every endpoint as it is built, not after
- Commit often with clear, descriptive commit messages

## What to avoid

- Don't use `any` in TypeScript — ever
- Don't skip validation — every request body must be validated with Zod
- Don't skip tests — write them alongside each feature, not after
- Don't use a BaaS (PocketBase, Supabase, Firebase) — the point is to build the backend ourselves
- Don't over-engineer — keep it simple and correct, not clever

## Current status

- [x] Repo created
- [x] Project scaffolded (TypeScript, ESLint, Prettier)
- [x] Hono + basic server running
- [x] PostgreSQL connected
- [x] Drizzle ORM set up with first migration
- [x] Auth endpoints (register, login, refresh, logout)
- [x] Applications CRUD
- [x] Filtering, sorting, pagination
- [x] Integration tests
- [ ] Docker — **skipped by decision**, staying local only (see `docs/ROADMAP.md`)
- [ ] Deployed to Railway / Fly.io — **skipped by decision**, staying local only (see `docs/ROADMAP.md`)

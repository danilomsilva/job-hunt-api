# Roadmap

## Who is building this

Danilo M. Silva — a Frontend Engineer with 6+ years in React and TypeScript,
deliberately expanding into full-stack development. This is Phase 1 of a structured
12-month engineering growth roadmap. The priority is to learn backend fundamentals
properly, not to ship fast with shortcuts.

## Learning goals (in order of priority)

1. Node.js + TypeScript backend from scratch
2. REST API design: resource naming, status codes, error shapes, pagination
3. PostgreSQL: schema design, migrations, relational data
4. Auth: JWT (access + refresh tokens), bcrypt, middleware guards
5. Testing: integration tests with Vitest + supertest
6. Deployment: Docker + Railway or Fly.io

## Tech stack decisions

Choices were made to favour learning over convenience — TypeScript-native tools
that stay close to the underlying concepts.

- **Runtime:** Node.js with TypeScript (strict mode)
- **Framework:** Hono — TypeScript-native, lightweight, excellent DX
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM — TypeScript-native, close to raw SQL, great for learning
- **Auth:** JWT (access token + refresh token pattern) + bcrypt
- **Testing:** Vitest + supertest
- **Linting:** ESLint + Prettier
- **Deployment:** Docker + Railway or Fly.io

---

## Phase 1 — Backend fundamentals (8 weeks)

Build this API: a production-quality job application tracker, live and deployed.
**Target: backend deployed within 8 weeks.**

| Stage                | Weeks | Outcome                                                                           |
| -------------------- | ----- | --------------------------------------------------------------------------------- |
| 1. Scaffold          | 1     | TypeScript strict, ESLint + Prettier, Hono server running, `/health` endpoint     |
| 2. Data layer        | 2     | PostgreSQL connected, Drizzle + first migration, `users` & `applications` schema  |
| 3. Auth              | 3–4   | `register` / `login` / `refresh` / `logout`, bcrypt, JWT, guard middleware, tests |
| 4. Applications CRUD | 4–5   | All five endpoints, Zod validation on every body, ownership checks, tests         |
| 5. List refinements  | 6     | Filtering, sorting, pagination on `GET /applications`, tests                      |
| 6. Hardening         | 7     | Unified error response shape, request logging, rate limiting, full test pass, CI  |
| 7. Deploy            | 8     | Docker image, Railway / Fly.io, env config, production smoke test                 |

See [`API.md`](API.md) for the domain model and endpoint contracts.

### Checklist

- [x] Repo created
- [x] Project scaffolded (TypeScript, ESLint, Prettier)
- [x] Hono + basic server running
- [x] PostgreSQL connected
- [x] Drizzle ORM set up with first migration
- [x] Auth endpoints (register, login, refresh, logout)
- [x] Applications CRUD
- [x] Filtering, sorting, pagination
- [ ] Integration tests
- [ ] Docker
- [ ] Deployed to Railway / Fly.io

---

## Phase 2 — Frontend (React + TypeScript)

_Placeholder — to be detailed once Phase 1 is deployed._

A separate repo. A React + TypeScript client that consumes this API: auth flow
with token refresh, the applications list with filtering/sorting/pagination wired
to the API, and create/edit/detail views for an application.

---

## Phase 3 — Full-stack & advanced topics

_Placeholder — to be detailed later._

Candidate areas: end-to-end deployment of both halves, caching, background jobs,
observability (structured logs, metrics, tracing), and CI/CD hardening.

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
6. ~~Deployment: Docker + Railway or Fly.io~~ — decided against; see "Deployment decision" below

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
- **Deployment:** none — decided to stay local; see "Deployment decision" below

---

## Phase 1 — Backend fundamentals (8 weeks)

Build this API: a production-quality job application tracker, running locally.

| Stage                | Weeks | Outcome                                                                           |
| -------------------- | ----- | --------------------------------------------------------------------------------- |
| 1. Scaffold          | 1     | TypeScript strict, ESLint + Prettier, Hono server running, `/health` endpoint     |
| 2. Data layer        | 2     | PostgreSQL connected, Drizzle + first migration, `users` & `applications` schema  |
| 3. Auth              | 3–4   | `register` / `login` / `refresh` / `logout`, bcrypt, JWT, guard middleware, tests |
| 4. Applications CRUD | 4–5   | All five endpoints, Zod validation on every body, ownership checks, tests         |
| 5. List refinements  | 6     | Filtering, sorting, pagination on `GET /applications`, tests                      |
| 6. Hardening         | 7     | Unified error response shape, request logging, rate limiting, full test pass, CI  |
| ~~7. Deploy~~        | —     | **Skipped by decision** — see "Deployment decision" below                         |

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
- [x] Integration tests
- [ ] Docker — **skipped by decision**, staying local only
- [ ] Deployed to Railway / Fly.io — **skipped by decision**, staying local only

### Deployment decision

Decided against deploying (2026-08-29). The backend is complete and fully
verified — this only concerns whether to also put it on a live URL.

Checked the three usual free options: Railway and Fly.io have both dropped
free tiers for new accounts (a card is required either way). Render is the
only one with a real no-card-required free tier, but its free Postgres
**expires 30 days after creation** (14-day grace period, then deleted), and
its free web service spins down after 15 minutes of inactivity. None of that
is a dealbreaker for a demo, but it means "deployed" would really mean
"redeployed every month," not a one-time milestone — overhead that doesn't
teach anything Stages 1–6 haven't already covered, for a project whose actual
goal is the backend fundamentals, not ops upkeep.

Everything in `docs/API.md` and this roadmap otherwise describes the app as
it runs locally via `docker compose up -d` + `npm run dev`. Phase 2 (the
frontend) will point at `localhost`, not a deployed URL.

---

## Phase 2 — Frontend (React + TypeScript)

_Placeholder — to be detailed once Phase 1 is done._

A separate repo. A React + TypeScript client that consumes this API: auth flow
with token refresh, the applications list with filtering/sorting/pagination wired
to the API, and create/edit/detail views for an application.

---

## Phase 3 — Full-stack & advanced topics

_Placeholder — to be detailed later._

Candidate areas: end-to-end deployment of both halves, caching, background jobs,
observability (structured logs, metrics, tracing), and CI/CD hardening.

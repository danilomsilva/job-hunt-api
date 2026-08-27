# Roadmap

## Who is building this

Danilo M. Silva — a Frontend Engineer with 6+ years in React and TypeScript,
deliberately expanding into full-stack development. This is Phase 1 of a structured
learning roadmap. The priority is to learn backend fundamentals properly, not to
ship fast with shortcuts.

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

## Phase 1 milestones

- [ ] Repo created
- [ ] Project scaffolded (TypeScript, ESLint, Prettier)
- [ ] Hono + basic server running
- [ ] PostgreSQL connected
- [ ] Drizzle ORM set up with first migration
- [ ] Auth endpoints (register, login, refresh, logout)
- [ ] Applications CRUD
- [ ] Filtering, sorting, pagination
- [ ] Integration tests
- [ ] Docker
- [ ] Deployed to Railway / Fly.io

## Broader context

This project is part of a 12-month engineering growth roadmap.

- **Phase 1 target:** backend live and deployed within 8 weeks.
- The frontend (React + TypeScript) will be built separately once the API is solid.

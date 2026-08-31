# Deployment

> **Status: not deployed. This is the plan, not a runbook.** Both halves of the
> project run locally only, by explicit decision
> ([`job-hunt-api` roadmap](ROADMAP.md#deployment-decision) ·
> [`job-hunt-ui` roadmap](https://github.com/danilomsilva/job-hunt-ui/blob/main/docs/ROADMAP.md#future--optional--not-scheduled-into-a-stage-yet)).
> This document is Phase 3 groundwork: the strategy we'd follow to take both
> apps live on a single VPS, and why each piece was chosen. Nothing here is
> wired up yet.

## Scope

How the two app containers plus Postgres would be built, shipped, and run in
production; the request path once live; environments and branch protection;
database migrations; secrets; domain/DNS; a minimal observability setup.

## The two apps today

- **`job-hunt-api`** — Hono + PostgreSQL + Drizzle. Has an opt-in multi-stage
  `Dockerfile` (`docker compose --profile app up --build`), built and run
  locally only as an exercise in the mechanics. `docker-compose.yml` here
  orchestrates Postgres (always) and the API (opt-in, `profiles: [app]`).
- **`job-hunt-ui`** — Vite + React SPA. Not containerized yet. The plan: its
  own image — a production build (`npm run build` → `dist/`) served by Caddy (the
  same tool as the edge proxy, so one web server to learn). Its config needs
  SPA fallback (unknown paths → `index.html`, so a refresh on
  `/applications/42` works) and cache headers (Vite fingerprints asset
  filenames, so cache them long; `index.html` must not be cached).

Local dev stays `npm run dev` on both sides plus `docker compose up -d` for
Postgres — the hot-reload loop, unchanged. Production is a separate path that
doesn't touch it.

## Target topology — single VPS

One VPS — **Hetzner Cloud CX22** (x86, 2 vCPU / 4 GB), Falkenstein or
Nuremberg region — running Docker Compose, four services on a private Compose
network. x86 rather than the cheaper CAX11 ARM shape so CI builds run on the
default (x86) GitHub runners with no cross-compilation.

| Service    | Image                         | Faces        | Role                                   |
| ---------- | ----------------------------- | ------------ | -------------------------------------- |
| `caddy`    | official `caddy`              | ports 80/443 | reverse proxy + automatic HTTPS        |
| `web`      | built from `job-hunt-ui`      | internal     | serves the static `dist/` bundle       |
| `api`      | built from `job-hunt-api`     | internal     | Hono server (`npm start`, long-lived)  |
| `postgres` | official `postgres:16-alpine` | internal     | volume-backed — the one stateful piece |

Caddy routes by `Host` header:

- `jobhunt.example.com` → `web` (static files)
- `api.jobhunt.example.com` → `api:3000`

Containers address each other by **Compose service name** — not `localhost`,
not the image name. `DATABASE_URL` on the API is
`postgres://…@postgres:5432/job_hunt`, exactly as the existing
`docker-compose.yml` already sets it for the opt-in `app` service.

### Request path once live

1. Browser → `https://jobhunt.example.com` → Caddy (TLS terminates here).
2. Caddy matches the host → proxies to `web`, which returns `index.html` plus
   the JS/CSS bundle.
3. The SPA boots **in the browser** and calls
   `https://api.jobhunt.example.com/...` directly. The `web` container is not
   in this path — it only ever served static files. (This is the common
   mental-model slip: a built SPA has no server side of its own; "the frontend
   calls the API" means the user's browser does.)
4. That API call → Caddy → `api:3000`.
5. The API reads/writes Postgres over the Compose network (`postgres:5432`).
6. Response travels back API → Caddy → browser.

Because the SPA and the API are on different subdomains, every API response
needs `Access-Control-Allow-Origin: https://jobhunt.example.com`. Requests
that carry an `Authorization` header or use `PATCH`/`DELETE` (i.e. most of
them) also trigger a preflight `OPTIONS` the API must answer with the matching
`Access-Control-Allow-*` headers before the browser will send the real
request. `job-hunt-api` already enables CORS for the local dev origin;
production just adds the real origin.

## Getting images onto the VPS

**Decision: build in CI, push to a registry, VPS pulls.** GitHub Actions
builds each image and pushes it to `ghcr.io`; the VPS only runs
`docker compose pull` then `up -d`. The VPS needs nothing but Docker — no build
toolchain, no source checkout, no CPU spent compiling — and every deploy is a
tagged image, so rollback is "pull the previous tag and restart". Build and
deploy stay separate concerns, as in real-world practice.

### Registry: GitHub Container Registry (`ghcr.io`)

**Decision: `ghcr.io`, over Docker Hub.** Both repos already live on GitHub
under `danilomsilva`, and GHCR is the lower-friction choice on every axis that
matters here:

- **Auth is built in.** GitHub Actions' automatic `GITHUB_TOKEN` can push to
  `ghcr.io/danilomsilva/*` — no separate account, no username/token pair to
  create and store as secrets. Docker Hub needs both.
- **The image lives next to the code**, on the repo's Packages tab, versioned
  alongside the source that built it.
- **No pull-rate limits to design around.** Docker Hub throttles anonymous and
  free-tier pulls and has revised those limits repeatedly through 2024–2025.
  GHCR has no equivalent cap.
- **Unlimited free private images.** Docker Hub's free plan allows only one.
- **Zero cost.** Public images are free with unlimited storage and bandwidth;
  pulls from GitHub Actions don't count against any quota either way.

Docker Hub's only real edge is name recognition and the volume of tutorials
that assume it — not enough to outweigh the above.

## CI/CD pipeline (each repo, on merge to `main`)

1. **Existing CI gate** — lint, format check, typecheck, full test suite,
   production build. Both repos already run this on every push to `main` and
   every PR; deploy just adds steps after it.
2. `docker build` the image.
3. Log in to `ghcr.io` with `GITHUB_TOKEN`; push two tags — the commit SHA and
   `latest`.
4. SSH to the VPS (private key from GitHub repo/Environment secrets).
5. On the VPS: `docker compose pull <service> && docker compose up -d <service>`.
6. **API only —** run `npm run db:migrate` against the production database as a
   release step, _before_ the new container starts taking traffic.
7. Caddy needs no change: same service name, same internal port.
8. **Post-deploy health check** — curl `https://api.jobhunt.<domain>/health`
   (and the web root); if either isn't `200`, fail the pipeline and alert.

**Rollback:** re-run step 5 with the image pinned to the previous SHA tag.
(A migration that has to be undone is a separate, manual job — write a
down-migration and deploy it forward; don't try to auto-revert on failure.)

## Reverse proxy: Caddy

A reverse proxy takes every inbound request on 80/443 and routes it to the
right internal container by rule (here, the `Host` header).

**Decision: Caddy.** It obtains and renews Let's Encrypt certificates
automatically with zero extra config, and the routing for this setup is a
handful of lines — two `Host` matches, each proxying to a service name.

## Environments

The standard shape is three environments — `develop` → `staging` →
`production` — each on its own host, changes promoted up the chain through
approval gates. This project keeps **one environment: production**, on the
single VPS. A solo learning project has neither the traffic nor the blast
radius to justify standing up and maintaining the other two; the three-tier
model is recorded here as what this would grow into, not something built now.

| Env        | Where   | Deploys on      | Database              |
| ---------- | ------- | --------------- | --------------------- |
| production | the VPS | merge to `main` | `job_hunt` on the VPS |

### Branch protection

`main` is protected — **no direct pushes**. Every change lands through a pull
request: CI must pass, and the PR is reviewed and approved before it merges.

Ruleset on the GitHub repo:

- Require a pull request before merging.
- Require status checks to pass (the existing lint / format / typecheck / test
  / build workflow) and the branch to be up to date with `main`.
- Block force-pushes to `main` and deletion of the branch.
- Apply to everyone, repo owner included — no bypass.

GitHub won't let a PR author approve their own PR, so on a solo repo the
"approved" step is either a second reviewer/account or a self-imposed gate:
open the PR, let CI go green, review the full diff, then merge. Either way the
rule holds — nothing reaches `main` except through a reviewed PR.

The deploy pipeline below therefore triggers on **merge to `main`**, which now
only happens through that flow.

## Database migrations (Drizzle)

Two steps, deliberately kept separate:

- **Generate — manual.** `npm run db:generate` diffs `src/db/schema.ts`
  against the last migration and writes a SQL file. Run by hand, reviewed,
  committed to the repo. Manual because a schema diff can be ambiguous — a
  column rename looks identical to "drop column, add column", and the second
  loses data. Drizzle prompts on the ambiguous cases; the generated SQL
  sometimes needs a hand edit.
- **Apply — automated.** `npm run db:migrate` runs pending migrations in
  order, as the release step in the pipeline above. Drizzle records which
  migrations it has applied in a table in the database itself
  (`__drizzle_migrations`), so re-running is a no-op — local and production
  converge by replaying the same committed files in the same order.

## Secrets

- **CI — GitHub repo or Environment secrets:** the VPS SSH private key; any
  build args. Registry auth is the built-in `GITHUB_TOKEN`, not a stored
  secret.
- **VPS — `.env` beside `docker-compose.yml`, gitignored:** `JWT_SECRET`,
  `DATABASE_URL`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, the Postgres
  password, the real domain names. Compose interpolates them via `${VAR}` —
  the current file already does this for `JWT_SECRET`.
- Postgres data lives in a named Docker volume. Set up `pg_dump` on a cron
  (dump to object storage or off-box) before the first real deploy — the
  database is the only piece that can't be rebuilt from a `docker pull`. Once,
  before going live, restore a dump into a throwaway database and check the
  data's intact — an untested backup isn't a backup.

## Host hardening

Not decisions — just the standard steps to run once, when the VPS is first
provisioned, before it's reachable from the internet. A public box gets its
SSH port brute-forced within minutes, so none of this is optional:

- **SSH:** log in with a key, not a password; disable password auth and root
  login; do day-to-day work as a non-root `deploy` user.
- **Firewall (`ufw`):** allow ports 22, 80, 443; deny everything else inbound.
- **`fail2ban`:** bans an IP after a few failed SSH logins. Install, leave the
  defaults.
- **`unattended-upgrades`:** applies security patches automatically.
- **Docker:** install from Docker's official apt repo (the distro's package is
  usually old). Don't mount the Docker socket into any container.
- **Docker logs:** configure them to rotate — by default they grow until the
  disk is full.

## Domain & DNS

**Decision: Cloudflare Registrar + Cloudflare DNS**, in "DNS only" mode (grey
cloud, no proxy). The registrar sells at cost with no renewal markup and free
WHOIS privacy; DNS is free and fast. "DNS only" keeps Caddy in charge of TLS
via the HTTP-01 challenge — no Cloudflare origin certificates or proxy-mode
TLS settings to reconcile. TLD: a plain `.com`, or `.dev` / `.app` (Google-run,
HTTPS-only, fine with Caddy). Not `.ie` — that needs an accredited Irish
registrar and more process than a portfolio project warrants.

Two DNS records, both pointing at the VPS (A for IPv4, AAAA for IPv6):
`jobhunt.<domain>` and `api.jobhunt.<domain>`.

## Observability

Switched on when the app goes live, not before. Deliberately minimal:

- **Errors — Sentry**, free Developer plan. One project for `job-hunt-api`,
  one for `job-hunt-ui`, each filtered by environment. (Chosen over Datadog,
  whose free tier is far more limited.)
- **Uptime — UptimeRobot**, free plan. A 5-minute HTTPS check on
  `jobhunt.<domain>` and on `api.jobhunt.<domain>/health`, alerting to email.
- **Resource alerts** — turn on Hetzner's built-in metric alerts for ~80% disk
  and memory. UptimeRobot tells you the box is already down; this warns you
  before it gets there (a full disk from Postgres data or Docker logs is the
  usual cause).
- No metrics stack and no distributed tracing until there's a concrete reason
  for one.

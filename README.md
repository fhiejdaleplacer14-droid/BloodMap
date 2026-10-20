# BloodMap NIR

A public map of active blood requests across Negros Island Region, with
coordinator review, generalized (municipality-level) locations and audited
access to contact details. It is built from the Figma file
*BloodMap NIR — Product Design*. Page 12 of that file, *Handoff and
Implementation Notes*, is the implementation spec.

> Portfolio project. All seeded requests, people and facilities are fictional
> and are labelled as demo data in the UI.

## Stack

| Layer      | Choice |
|------------|--------|
| Frontend   | React · TypeScript · Vite · Tailwind CSS (`/frontend`) |
| Backend    | Laravel REST API · Sanctum SPA cookie auth (`/backend`) |
| Database   | PostgreSQL. Local via Docker Compose, configured only through `DB_*` env vars |
| Maps       | Leaflet + OpenStreetMap (attribution always visible) |
| CI         | GitHub Actions (`.github/workflows/ci.yml`) |

## Repository layout

```
.
├── backend/                 Laravel API
├── frontend/                React SPA
├── docker/postgres/init/    First-start scripts for the local Postgres container
├── docker-compose.yml       Local PostgreSQL 17
├── .env.example             Values docker-compose reads (copy to .env)
└── .github/workflows/ci.yml
```

## Prerequisites

- Docker (for the local database)
- PHP 8.2+ with the `pdo_pgsql` extension enabled, and Composer
- Node.js 24 (see `frontend/.nvmrc`) and npm

## Local setup

```bash
# 1. Database
cp .env.example .env
docker compose up -d            # PostgreSQL on localhost:5432 (+ bloodmap_testing DB)

# 2. API  → http://localhost:8000
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed      # NIR geography + fictional demo data
php artisan serve
php artisan queue:work          # second terminal: emails & automated checks
php artisan schedule:work       # third terminal: expiry every 5 min, reminders

# 3. SPA  → http://localhost:5173
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Re-run `php artisan migrate:fresh --seed` at any time to reset the demo.
Seed dates are relative to now, so the demo always has live requests. In
development, emails go to `storage/logs/laravel.log` (`MAIL_MAILER=log`).

### Demo accounts

All demo records are fictional and carry `is_demo = true`. Every account
uses the password in `DEMO_PASSWORD` (default `BloodMap-demo-2026!`).

| Email | Role | Notes |
|-------|------|-------|
| `juan.demo@example.org` | Donor | Has saved requests, one of them expired |
| `ana.desk@example.org` | Facility submitter `S-0142` | San Carlos Blood Services Desk (demo) |
| `m.coord@example.org` | Coordinator | Negros Occidental (North) review queue |
| `lina.t@example.org` | Coordinator | Negros Oriental |
| `admin@example.org` | Administrator | |
| `admin2@example.org` | Administrator | Second admin for promotions to Administrator |

## API

Sanctum SPA cookie auth: the SPA calls `GET /sanctum/csrf-cookie`, then
`POST /login`. Every other endpoint lives under `/api`. Run
`php artisan route:list --except-vendor` for the full list. The contracts
follow Figma's *Handoff · API & data* frame plus `docs/decisions.md`.

- Policies decide every action; resources decide every field.
- Public responses carry the municipality centroid only, never an address
  or a facility's coordinates.
- The desk contact is gated by `contact_visible_to`. Coordinators see it
  masked until they reveal it, and each reveal is audited.
- `audit_logs` is insert-only: a database trigger rejects UPDATE and DELETE.

## Using a hosted Postgres (for example Supabase)

You don't need any code changes. In `backend/.env`, set `DB_HOST`, `DB_PORT`,
`DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` to the provider's values and
`DB_SSLMODE=require`, then run `php artisan migrate`. The schema uses plain
PostgreSQL, with no PostGIS.

## Checks

| Where      | Command |
|------------|---------|
| frontend   | `npm run lint` · `npm run typecheck` · `npm run build` |
| backend    | `vendor/bin/pint --test` · `vendor/bin/phpstan analyse --memory-limit=1G` · `php artisan test` (uses the `bloodmap_testing` database) |

CI runs the same checks on every push to `main` and on every pull request.
The backend job runs against a PostgreSQL service container.

### End-to-end flows (Playwright)

`frontend/e2e` covers the seven prototype flows from Figma page 11 (A discover ·
B register · C save · D submit · E review · F administer · G assistant), plus
flow A on a phone-sized screen.

```bash
cd frontend
npx playwright install chromium   # first time only (local runs use your installed Chrome)
npm run test:e2e
```

The suite starts its own API (`localhost:8100`) and frontend (`localhost:5180`)
so your dev servers can keep running. Before every run it resets and
demo-seeds the `bloodmap_e2e` database (created by the Docker init script; on
an existing volume create it once with `CREATE DATABASE bloodmap_e2e`). It
refuses to reset any database whose name doesn't end in `_e2e`.

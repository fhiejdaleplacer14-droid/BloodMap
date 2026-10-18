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
php artisan migrate
php artisan serve

# 3. SPA  → http://localhost:5173
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

## Using a hosted Postgres (for example Supabase)

You don't need any code changes. In `backend/.env`, set `DB_HOST`, `DB_PORT`,
`DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` to the provider's values and
`DB_SSLMODE=require`, then run `php artisan migrate`. The schema uses plain
PostgreSQL, with no PostGIS.

## Checks

| Where      | Command |
|------------|---------|
| frontend   | `npm run lint` · `npm run typecheck` · `npm run build` |
| backend    | `vendor/bin/pint --test` · `php artisan test` (uses the `bloodmap_testing` database) |

CI runs the same checks on every push to `main` and on every pull request.
The backend job runs against a PostgreSQL service container.

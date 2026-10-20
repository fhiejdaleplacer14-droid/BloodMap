<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/banner-dark.svg">
    <img src="docs/readme/banner-light.svg" alt="BloodMap NIR — a public map of active blood requests across Negros Island Region" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/fhiejdaleplacer14-droid/BloodMap/actions/workflows/ci.yml"><img src="https://github.com/fhiejdaleplacer14-droid/BloodMap/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/React-TypeScript-3178C6?logo=typescript&logoColor=white" alt="React + TypeScript">
  <img src="https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white" alt="Laravel 12">
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 17">
  <img src="https://img.shields.io/badge/WCAG-2.2%20AA-1F7A4D" alt="WCAG 2.2 AA">
</p>

<p align="center">
  <a href="#screenshots">Screenshots</a> ·
  <a href="#local-setup">Run it locally</a> ·
  <a href="#demo-accounts">Demo accounts</a> ·
  <a href="docs/decisions.md">Design decisions</a>
</p>

---

BloodMap is a public map of active blood requests across Negros Island
Region. Facility desks post requests, coordinators review each one before it
goes public, and anyone can see where help is needed, without an address or a
private phone number ever reaching the map.

It is built from the Figma file *BloodMap NIR — Product Design*. Page 12 of
that file, *Handoff and Implementation Notes*, is the implementation spec.
Any deviation from it is logged in [`docs/decisions.md`](docs/decisions.md).

> [!NOTE]
> This is a portfolio project. All seeded requests, people and facilities are
> fictional and are labelled as demo data in the UI.

## Highlights

- **🗺️ Find a request in seconds.** Filter by blood type, status, posting date
  and area, on a list or a live map, on desktop or phone.
- **🔒 Private by design.** Requests are placed at the municipality centroid,
  never at an address or a facility's coordinates. Desk contacts are gated by
  role, coordinators see them masked until they choose to reveal them, and
  every reveal is audited.
- **✅ Reviewed before it's public.** Coordinators approve requests, send them
  back for correction or reject them, helped by automated checks for phone
  numbers, personal names, duplicates and missing desk hours.
- **💬 A built-in guide.** It answers "how does this work?" questions from
  approved help articles and cites its source. It never gives medical advice
  or eligibility assessments. It needs no external AI API and costs nothing to
  run.
- **🧾 An audit trail that can't be edited.** `audit_logs` is insert-only: a
  database trigger rejects every UPDATE and DELETE.
- **♿ Accessible.** Every screen, for every role, is scanned against WCAG 2.2
  AA in light and dark mode on every push.

### Who uses it

| Role | What they can do |
|------|------------------|
| **Visitor** | Browse and filter requests, open the details, ask the guide. No account needed. |
| **Donor** | Save requests, get notified when one changes, and see desk contacts after signing in. |
| **Facility submitter** | Post requests through a guided wizard, fix requests sent back for correction, and close them when fulfilled. |
| **Coordinator** | Work a regional review queue, approve or send back requests, and reveal contacts (audited). |
| **Administrator** | Manage users and coordinator coverage, and read the audit log, platform metrics and system settings. |

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/readme/landing.png" alt="Landing page with a map preview of an O+ request in San Carlos City"></td>
    <td width="50%"><img src="docs/readme/explorer.png" alt="Request explorer: filters and request cards beside a map of Negros Island"></td>
  </tr>
  <tr>
    <td align="center"><b>Landing</b></td>
    <td align="center"><b>Explorer</b>: list and map, with filters</td>
  </tr>
  <tr>
    <td><img src="docs/readme/details-dark.png" alt="Request details in dark mode with an approximate area on the map"></td>
    <td><img src="docs/readme/guide.png" alt="The BloodMap guide answering what request statuses mean, with its source"></td>
  </tr>
  <tr>
    <td align="center"><b>Request details</b> (dark mode)</td>
    <td align="center"><b>The guide</b>: answers cite their help article</td>
  </tr>
  <tr>
    <td><img src="docs/readme/review.png" alt="Coordinator review screen with submitted information, public preview and automated checks"></td>
    <td><img src="docs/readme/submitter.png" alt="Facility submitter's list of requests with status badges"></td>
  </tr>
  <tr>
    <td align="center"><b>Coordinator review</b> with automated checks</td>
    <td align="center"><b>Facility desk</b>: my requests</td>
  </tr>
  <tr>
    <td><img src="docs/readme/admin-dark.png" alt="Administrator platform overview with metrics and charts in dark mode"></td>
    <td><img src="docs/readme/donor.png" alt="Donor's saved requests"></td>
  </tr>
  <tr>
    <td align="center"><b>Admin overview</b> (dark mode)</td>
    <td align="center"><b>Donor</b>: saved requests</td>
  </tr>
</table>

### On a phone

<table>
  <tr>
    <td width="33%"><img src="docs/readme/phone-list.png" alt="Phone: list of requests with filters and a list/map toggle"></td>
    <td width="33%"><img src="docs/readme/phone-map.png" alt="Phone: map with a bottom sheet of requests in view"></td>
    <td width="33%"><img src="docs/readme/phone-details.png" alt="Phone: request details with save and log-in-for-contact actions"></td>
  </tr>
  <tr>
    <td align="center">List</td>
    <td align="center">Map and sheet</td>
    <td align="center">Details</td>
  </tr>
</table>

## Stack

| Layer      | Choice |
|------------|--------|
| Frontend   | React · TypeScript · Vite · Tailwind CSS · TanStack Query · React Router · Radix (`/frontend`) |
| Backend    | Laravel REST API · Sanctum SPA cookie auth (`/backend`) |
| Database   | PostgreSQL. Local via Docker Compose, configured only through `DB_*` env vars |
| Maps       | Leaflet + OpenStreetMap (attribution always visible) |
| Testing    | PHPUnit · Playwright · axe-core (WCAG 2.2 AA) |
| CI         | GitHub Actions (`.github/workflows/ci.yml`) |

## Repository layout

```
.
├── backend/                 Laravel API
├── frontend/                React SPA
├── docs/                    Design decisions and README assets
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
The backend job runs against a PostgreSQL service container. A third job then
runs the Playwright suite below (flows A–G plus WCAG 2.2 AA scans) against its
own PostgreSQL service and uploads the HTML report as an artifact.

### End-to-end flows (Playwright)

`frontend/e2e` covers the seven prototype flows from Figma page 11 (A discover ·
B register · C save · D submit · E review · F administer · G assistant), plus
flow A on a phone-sized screen, and an axe-core WCAG 2.2 AA scan of every
screen for every role in light and dark mode (`z-a11y*.spec.ts`).

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

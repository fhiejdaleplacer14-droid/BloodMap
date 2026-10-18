# Implementation decisions

The Figma file (page 12 *Handoff and Implementation Notes*) is the spec. Where it
contradicts itself, the decision below wins. Figma node IDs are given so each
choice can be traced. Decided 2026-10-19.

| # | Topic | Conflict in the file | Decision |
|---|-------|----------------------|----------|
| 1 | Coordinator routes | `/coordination/*` (51:423) vs `/coord/*` (54:296); API `/api/coordinator/queue` + separate actions (51:476) vs `/api/coord/queue` + `…/decision` (54:302) | SPA: `/coord`, `/coord/queue`, `/coord/requests/:id`, `/coord/activity`. API: `/api/coordinator/queue`, `/api/coordinator/summary`, `POST /api/requests/{id}/approve · /request-correction · /reject`, `POST /api/requests/{id}/reveal-contact` (audited). |
| 2 | Create / my requests routes | `/app/requests/new` (51:418) vs `/requests/new?step=1..3` (54:274) | `/requests/new?step=1..3` and `/requests/mine`. Donor workspace stays at `/app`, `/app/saved`, `/app/activity`, `/app/profile`. |
| 3 | Urgency enum | `within_24h\|within_72h\|scheduled` (51:326) vs component variants Urgent/Soon/Scheduled (5:222) vs `urgency=critical,urgent` (55:191) | `within_24h \| within_72h \| scheduled` in the API, the database and the URL. Labels follow 5:222: "Needed within 24 h", "Needed within 72 h", "Scheduled date". Urgency is never a triage level. |
| 4 | PostGIS | Cover (50:255) and privacy rule (51:578) mention PostGIS | Plain PostgreSQL. Municipalities store `centroid_lat` / `centroid_lng` (decimal); the bbox filter is an indexed numeric range. |
| 5 | Public location shape | `facility_area` (55:248) vs `location {municipality, province, point, precision}` (51:485) | The 51:485 shape. `point` is always the **municipality centroid** `[lng, lat]`; `precision: "municipality"`. The server never returns facility or street coordinates for a request. Map Area circle radius is 2500 m (51:364). Public map maxZoom is 13. |
| 6 | Facility vs coordination point | `facility_id` required (54:280) vs optional `coordination_point_id` (51:578) | One `coordination_points` table (public facility desks). It is **required** on every request, because a facility submitter is bound to one authorized desk (39:1074, 30:682). Desk markers may be plotted at their published location (55:249). |
| 7 | Create flow | `POST` creates `pending_review` (54:280) vs draft + `POST …/submit` (51:519) | `POST /api/requests` creates a `draft` (autosave, "Save draft"). `POST /api/requests/{id}/submit` moves it to `pending_review`. |
| 8 | Search params | `types[]`, `posted_after`, `sort=-updated_at` (51:483) vs `blood_type[]`, `urgency`, `q` (54:211) | API: `bbox`, `blood_type[]`, `urgency[]`, `status`, `posted_after`, `q`, `sort`, `page` (30 per page). SPA URL keys follow 55:191: `type`, `urgency`, `q`, `sort`, `view`, `sel`, `z`, `c`. |
| 9 | Saved / audit endpoints | `/api/me/saved-requests/{id}` vs `/api/me/saved`; `/api/admin/audit-logs` vs `/api/admin/audit` | `GET /api/me/saved-requests`, `POST` / `DELETE /api/me/saved-requests/{id}`; `GET /api/admin/audit-logs?actor&action&from&to` (read-only). |
| 10 | Role change to admin | "needs a second approval" (51:551) vs reason-only (54:311) | Per dialog 39:1074: every role change requires a reason (audited). Promotion to **Administrator** creates a pending change that a *different* administrator must approve. |
| 11 | Roles | Sidebar shows a fourth role (30:682) | `donor`, `facility_submitter` (bound to one coordination point; creates requests, cannot publish), `coordinator` (bound to an area), `admin`. The nav comes from `/api/me` permissions. |
| 12 | Tailwind config | v3 `tailwind.config.ts` (51:437) vs repo on Tailwind v4 | Same token names in CSS via `@theme` mapped to `var(--…)`; dark mode via `[data-theme="dark"]`. |

## Copy that differs by context
The demo labels differ by screen ("Sample data", "Demo data", "Demonstration
map · fictional requests", "Demo environment · sample data"). Each screen uses
its frame's exact copy. Whether a label renders is decided by `is_demo` on the
records being shown.

## Open items carried from Final design review (56:193)
- **Tablet (768–1023):** built from the rules in 55:252. No frames exist.
- **Copy validation** with blood-service staff and donors before launch.
- **Map tiles:** development uses `tile.openstreetmap.org` (configured through
  `VITE_MAP_TILE_URL`). Production needs a provider whose terms allow the
  traffic, plus a check that the zoom-13 cap holds.

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
| 13 | Tablet layout | Design System 49:277: sidebar becomes a drawer, Explorer list overlays the map as a side sheet. Handoff 55:252: sidebar collapses to a 72 px icon rail, Explorer splits into a 360 panel plus map | Handoff 55:252 (page 12 is authoritative). |
| 14 | Dark elevation | Elevation styles (49:233) only have light values | The same shadows apply in both themes. Dark surfaces rely on borders, as the design already does. |
| 15 | Destructive button fill | Destructive uses status/critical/fg (5:119). In Dark that is #E2626F, and the white label only reaches ~3.4:1 (fails WCAG 1.4.3) | Use bg/brand (identical to the Light value, #B42332 in both themes). Light output is unchanged; Dark reaches ~6:1. |
| 16 | Urgency source | The Create wizard (31:204) has no urgency field, yet cards show "Needed within 72 h" (0012: published Oct 15, needed Oct 18) | Urgency is **derived** on submit from needed-by + desk-window end (≤ 24 h, ≤ 72 h, otherwise scheduled). It is stored, so it stays the requester-stated window and is never re-triaged. |
| 17 | Request category | 31:270 shows only "Scheduled procedure" | Enum `scheduled_procedure` only. **Open: the full category list is needed.** |
| 18 | Expiry | 31:899 "Automatically on Oct 18, 2026 · 17:00" | `expires_at` = needed-by date + desk-window end (default 17:00), Asia/Manila, set on approval. |
| 19 | Contact | Handoff speaks of a contact phone; step 2 (31:572) offers desk phone · desk email · "No direct contact" | `contact_method` on the request; the value always comes from the approved coordination point. Requests never store a phone number. |
| 20 | Queue assignment | Handoff 51:530 "409 if assigned elsewhere" but lists no assign endpoint; queue 35:462 has "Assign to me" and tabs | Added `POST /api/requests/{id}/assign`; queue tabs `unassigned · mine · needs_correction · all_open` with counts. Submitters appear as references (`S-0142`), not names. |
| 21 | In-app notifications | Sidebar "Notifications" and dashboard updates (44:823); no endpoint listed | Added `GET /api/me/notifications` and `POST /api/me/notifications/read` (Laravel database notifications). |
| 22 | Lookups | Create step 1 needs province/city; step 2 needs the authorized point | Added `GET /api/municipalities` (public, centroids only) and `GET /api/coordination-points` (scoped by role). |
| 23 | Paused requests | Restriction pauses open requests (55:345) | A paused request disappears from search **and** its detail URL (404) until an admin decision; it is not deleted. |
| 24 | Explorer filters | Desktop triggers (14:69) and the mobile sheet (25:569) show Status · Date posted (incl. custom range, 19:3128) · Area, which the Handoff API lacks | `status[]` = `active` (default) and/or `fulfilled` ("Recently fulfilled" = within 7 days); `posted_before` alongside `posted_after`; `province` for Area. "Near me" stays in the browser and only sorts (25:643). |

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

## Open items from Phase 3 (backend)
- **Request categories:** only "Scheduled procedure" exists in Figma (#17).
- **Reports:** the coordinator sidebar shows "Reports" and the resource has `can.report`, but no frame defines the report flow or endpoint yet.
- **Weekly area summary email:** the preference exists (29:1149, off by default); the digest itself isn't designed, so it isn't sent yet.
- **Email copy:** notification emails use plain, factual copy (`backend/lang/en/notifications.php`) because Figma has no email frames. Review it with blood-service staff along with the rest of the copy (56:258).

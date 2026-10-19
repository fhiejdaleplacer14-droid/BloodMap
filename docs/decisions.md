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

| 25 | Explorer URL keys beyond 55:191 | Status, Date posted, Area and paging have no URL keys | `status=active,fulfilled` (omitted when Active only), `posted=today\|3d\|7d` or `from`/`to` (YYYY-MM-DD, Manila), `area=occidental\|oriental\|siquijor\|near`, `page`. `c` is written at 2 dp (≈1 km, as in 55:191), so a shared link never carries a precise position. Invalid values are dropped. |
| 26 | Sort labels | Only "Most recent" appears (14:113) | `-updated_at` "Most recent", `urgency` "Needed soonest", `expires_at` "Expiring soonest", `-published_at` "Newest posted"; "Near me" shows "Nearest to me" and sorts in the browser. **Open: confirm the labels.** |
| 27 | Pages with no frames | Header/footer link to About, Privacy notice, Terms of use, Data retention, Contact support, Report a problem; "Read the full guide" | How It Works → `/#how-it-works`, Safety → `/#safety`, About → the footer product overview (`/#about`), "Read the full guide" → `/#safety`, Project documentation / GitHub → the repository. The rest render as plain text (not dead links) until written. Unknown routes redirect to `/`. |
| 28 | Report action | Detail shows Report (15:731, 15:859); no flow or endpoint exists | Hidden until the report flow is designed (open item below). |
| 29 | Facility markers | Map key and frames show coordination points; the API had no public source | `GET /api/coordination-points/public` (name, municipality, published point — no phone/email/hours). Demo desks sit on their municipality centroid, so the tile is drawn beside the request label; coordinates are unchanged. |
| 30 | Regional focus map | 21:3755 outlines the selected province | No province boundaries exist (no PostGIS/GeoJSON), so the map frames the province's municipalities and a labelled chip links to the Explorer. Counts come from `by_province` on `/api/stats/public`. |
| 31 | Map controls | "Map layers" (14:527) has no frame | Toggles the Map key. |
| 32 | Search this area | 14:538 button vs. 55:206 auto-refetch | Tablet/desktop refetch automatically (300 ms debounce); on mobile auto-search is off and the button appears after a pan. |
| 33 | Location search | Search box filters by `q`, but results are also bounded by the map | A `q` matching one municipality moves the map there (zoom 12); any other text resets the view to all of NIR so the search covers the region. Choosing a province in Area frames it. |
| 34 | After sign-in | No frame defines the landing route | `?next=` (same-site paths only), otherwise the role's home: donor `/app`, facility submitter `/requests/mine`, coordinator `/coord`, admin `/admin`. |
| 35 | Approximate area | 9:256 at every zoom | Drawn from zoom 10 up; below that a 2.5 km circle is a few pixels wide. The selected request is drawn outside clusters so it never hides in one. |
| 36 | Safety section contrast | 21:3770 uses text/tertiary on bg/inverse (~3.4:1, fails 1.4.3) | Secondary copy there uses on-inverse at 72 % (`text-on-inverse-muted`), ≥ 4.5:1. |
| 37 | Donor notifications page | Sidebar links "Notifications", no frame | `/app/notifications` lists the same update rows as the Overview panel (28:203), paginated, with "Mark all as read". Copy for each update kind is minimal and factual. |
| 38 | Recently viewed | 28:290 shows it, no source defined | Kept on the device only (localStorage, max 6, switch in Profile › Privacy). The server never records what a donor looks at. |
| 39 | Sessions list | 29:1290 shows device + location | Device and last-active only. No geo-IP lookup, so no location; session IDs are HMAC-hashed in the API. |
| 40 | Close request reason | 32:1755 has no reason field; Handoff (51:476) and the API require one | The dialog keeps the frame's copy and adds "Reason for closing" (min 3 characters, kept in the history, not public). |
| 41 | Owner routes | Frames name no URLs for detail/drafts | `/requests/new?step=1..3&id=…` (wizard), `/requests/mine`, `/requests/drafts` (sidebar "Drafts" = My Requests locked to draft), `/requests/mine/:id` (owner detail), `/requests/mine/:id/submitted`. Only accounts with `requests.own` reach them. |
| 42 | Submitter sidebar counts | 32:841 shows "3" and "1" without defining them | My Requests = Active tab count (pending review + active); Drafts = drafts. Both come from `meta.counts` of `GET /api/requests/mine`. |
| 43 | My Requests tabs | 32:959 tab counts only | Needs action = draft + needs correction; Active = pending review + active; Closed & expired = fulfilled, closed, expired, rejected. Counts follow the search/filters, not the tab. |
| 44 | Editing from My Requests | 32:959 disables "Edit details" on active requests | Edit is offered for drafts and needs-correction only (it opens the wizard; needs-correction lands on Review with the coordinator's note on top). Active rows show the disabled item with the frame's note, even though the API would accept non-material edits. |
| 45 | Wizard saving | Frames show "Save draft" only | Every "Continue" also saves (POST once, then PATCH) so steps survive reloads. Server validation errors jump back to the step that owns the field. |
| 46 | Desk time window | 31:183 shows one "08:00 – 17:00" field | Two native time inputs (opens / closes) under one label; both or neither, closing after opening. |
| 47 | Privacy review checks | 31:840 shows three green checks | "No street address" always passes (there is no address field). "No patient name…" uses the server's description screener on the saved draft (`privacy_review.flags`, owner only); a hit turns it into a warning — it never blocks. "Contact limited to an approved desk" always passes (contact only comes from the coordination point). |
| 48 | Preview card ID | 31:380 shows "BM-2026-····" | Kept as in the frame: the ID isn't shown in the public preview until the request is published. |
| 49 | Request history | 32:1978 includes "Expiry reminder scheduled · System" | History is read from `audit_logs` (`GET /api/requests/{id}/history`, owner or reviewer only). Reminders aren't audited, so that row doesn't appear. Saves/unsaves never appear; contact reveals only for reviewers. Edits made during a correction are folded into "Resubmitted with changes · Changed: …". |
| 50 | "Approved and published" note | 32:2042 | Static copy "Submitted details confirmed — not a medical verification." under every approval. |
| 51 | Submitted card | 31:1223 frame has a fixed 66 px height (bug) | Card sizes to its content: tag, ID, status, body, "What happens next", actions. |
| 52 | Submitter bottom nav | No mobile frame for submitters | Home · Requests · Create · Alerts · Profile, same pattern as the donor bottom nav (55:269). |
| 53 | Public IDs | `BM-YYYY-NNNN` from the row id | Creation steps past IDs already used by seeded/imported requests, and the draft, its ID and the audit entry are written in one transaction. |

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

## Open items from Phase 5 (workspaces)
- **Submitter "Overview"** (32:841) has no frame; it opens the shared workspace overview (`/app`).
- **Role chip** shows "Facility submitter · S-0142" (account reference); 32:841 shows "San Carlos desk". A short desk label isn't in the data model yet.
- **Copy without frames**, kept minimal in `locales/en/manage.json`: empty states, toasts, "Correction requested" banner, "Continue draft", history titles other than those in 32:1978.

## Open items from Phase 4 (public site)
- **Copy without frames**, kept minimal and in `locales/en`: sort labels (#26), "This request isn't available" (404 detail), "Couldn't update saved requests", "Removed from saved", "We couldn't get your location", the cluster/facility marker labels, and the Register/Login "Enter your full name." / "Enter your password." messages.
- **Mobile Explorer**: List/Map toggle and full-screen detail work now; the bottom sheet (peek 160 · half · full) and the full-screen filter sheet arrive with Phase 6 (page 10 frames).
- **Assistant launcher** (14:581) is Phase 6.

## Open items from Phase 3 (backend)
- **Request categories:** only "Scheduled procedure" exists in Figma (#17).
- **Reports:** the coordinator sidebar shows "Reports" and the resource has `can.report`, but no frame defines the report flow or endpoint yet.
- **Weekly area summary email:** the preference exists (29:1149, off by default); the digest itself isn't designed, so it isn't sent yet.
- **Email copy:** notification emails use plain, factual copy (`backend/lang/en/notifications.php`) because Figma has no email frames. Review it with blood-service staff along with the rest of the copy (56:258).

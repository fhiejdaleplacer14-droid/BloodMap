import { z } from 'zod'
import { isIsoDate, manilaToday, shiftDate } from '../dates'
import { BLOOD_TYPES, URGENCIES, type BloodType, type Province, type Urgency } from '../request'

/*
 * Explorer URL state (Handoff 55:189, decisions #8, #24, #25). The query string
 * is the source of truth so every view can be shared, bookmarked and restored
 * with Back/Forward:
 *
 *   /requests?type=O-,O%2B&urgency=within_24h&q=bacolod&sort=urgency
 *            &status=active,fulfilled&posted=7d&area=occidental
 *            &view=split&sel=BM-2026-0012&z=10&c=10.67,122.95&page=2
 *
 * Invalid values are dropped, never thrown.
 */

export const SORTS = ['-updated_at', 'urgency', 'expires_at', '-published_at'] as const
export type Sort = (typeof SORTS)[number]

export const VIEWS = ['split', 'list', 'map'] as const
export type View = (typeof VIEWS)[number]

/** Public status filter (25:599): Active · Recently fulfilled. */
export const PUBLIC_STATUSES = ['active', 'fulfilled'] as const
export type PublicStatus = (typeof PUBLIC_STATUSES)[number]

/** Date posted quick ranges (19:3131); a custom range uses from/to. */
export const POSTED_RANGES = ['today', '3d', '7d'] as const
export type PostedRange = (typeof POSTED_RANGES)[number]
const POSTED_DAYS: Record<PostedRange, number> = { today: 1, '3d': 3, '7d': 7 }

/** Area (25:625). "near" sorts by distance in the browser only — never sent (25:643). */
export const AREAS = ['occidental', 'oriental', 'siquijor', 'near'] as const
export type Area = (typeof AREAS)[number]
export const AREA_PROVINCE: Record<Exclude<Area, 'near'>, Province> = {
  occidental: 'Negros Occidental',
  oriental: 'Negros Oriental',
  siquijor: 'Siquijor',
}

/** Public map zoom cap — areas must never read as points (55:248). */
export const MAX_PUBLIC_ZOOM = 13

export type ExplorerParams = {
  types: BloodType[]
  urgency: Urgency[]
  status: PublicStatus[]
  posted: PostedRange | null
  from: string | null
  to: string | null
  area: Area | null
  q: string
  sort: Sort
  view: View
  sel: string | null
  z: number | null
  /** [lat, lng] — matches the c=10.67,122.95 order in 55:191. */
  c: [number, number] | null
  page: number
}

export const DEFAULT_PARAMS: ExplorerParams = {
  types: [],
  urgency: [],
  status: ['active'],
  posted: null,
  from: null,
  to: null,
  area: null,
  q: '',
  sort: '-updated_at',
  view: 'split',
  sel: null,
  z: null,
  c: null,
  page: 1,
}

/** "O+" arrives as "O " when a raw + was not percent-encoded. */
const normalizeType = (value: string) => value.trim().toUpperCase() + (/ $/.test(value) ? '+' : '')

function list<T extends string>(raw: string | null, allowed: readonly T[], normalize = (v: string) => v.trim()): T[] {
  if (!raw) return []
  const values = raw.split(',').map(normalize)
  return [...new Set(values.filter((v): v is T => (allowed as readonly string[]).includes(v)))]
}

const zoomSchema = z.coerce.number().int().min(5).max(MAX_PUBLIC_ZOOM)
const centerSchema = z
  .string()
  .transform((raw) => raw.split(',').map(Number))
  .pipe(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]))
const pageSchema = z.coerce.number().int().min(1).max(10_000)
const selSchema = z.string().regex(/^BM-\d{4}-\d{4,}$/)

function safe<T>(schema: z.ZodType<T>, raw: string | null): T | null {
  if (raw === null) return null
  const result = schema.safeParse(raw)
  return result.success ? result.data : null
}

function oneOf<T extends string>(raw: string | null, allowed: readonly T[]): T | null {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : null
}

/** Typed state from the URL; anything invalid falls back to its default. */
export function parseExplorerParams(search: URLSearchParams, today = manilaToday()): ExplorerParams {
  const status = list(search.get('status'), PUBLIC_STATUSES)
  const posted = oneOf(search.get('posted'), POSTED_RANGES)

  // Custom range: both ends optional, valid dates, To ≥ From, never in the future (19:3185).
  let from = search.get('from')
  let to = search.get('to')
  from = from && isIsoDate(from) && from <= today ? from : null
  to = to && isIsoDate(to) && to <= today ? to : null
  if (from && to && to < from) {
    from = null
    to = null
  }

  return {
    types: list(search.get('type'), BLOOD_TYPES, normalizeType),
    urgency: list(search.get('urgency'), URGENCIES),
    status: status.length ? status : DEFAULT_PARAMS.status,
    // A quick range wins over a custom one.
    posted,
    from: posted ? null : from,
    to: posted ? null : to,
    area: oneOf(search.get('area'), AREAS),
    q: (search.get('q') ?? '').trim().slice(0, 100),
    sort: oneOf(search.get('sort'), SORTS) ?? DEFAULT_PARAMS.sort,
    view: oneOf(search.get('view'), VIEWS) ?? DEFAULT_PARAMS.view,
    sel: safe(selSchema, search.get('sel')),
    z: safe(zoomSchema, search.get('z')),
    c: safe(centerSchema, search.get('c')),
    page: safe(pageSchema, search.get('page')) ?? 1,
  }
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i])

/** Canonical query string: only non-default keys, in a stable order. */
export function serializeExplorerParams(params: ExplorerParams): URLSearchParams {
  const out = new URLSearchParams()
  if (params.types.length) out.set('type', params.types.join(','))
  if (params.urgency.length) out.set('urgency', params.urgency.join(','))
  if (params.q) out.set('q', params.q)
  if (params.sort !== DEFAULT_PARAMS.sort) out.set('sort', params.sort)
  if (!sameList([...params.status].sort(), DEFAULT_PARAMS.status)) out.set('status', params.status.join(','))
  if (params.posted) out.set('posted', params.posted)
  if (params.from) out.set('from', params.from)
  if (params.to) out.set('to', params.to)
  if (params.area) out.set('area', params.area)
  if (params.view !== DEFAULT_PARAMS.view) out.set('view', params.view)
  if (params.sel) out.set('sel', params.sel)
  if (params.z !== null) out.set('z', String(params.z))
  // 2 dp (~1 km), as in 55:191 — a shared link never carries a precise position.
  if (params.c) out.set('c', params.c.map((n) => n.toFixed(2)).join(','))
  if (params.page > 1) out.set('page', String(params.page))
  return out
}

/** Filters that change results (not view, selection or viewport). */
export type ExplorerFilters = Pick<ExplorerParams, 'types' | 'urgency' | 'status' | 'posted' | 'from' | 'to' | 'area' | 'q'>

export const DEFAULT_FILTERS: ExplorerFilters = {
  types: DEFAULT_PARAMS.types,
  urgency: DEFAULT_PARAMS.urgency,
  status: DEFAULT_PARAMS.status,
  posted: null,
  from: null,
  to: null,
  area: null,
  q: '',
}

export function filtersOf(params: ExplorerParams): ExplorerFilters {
  const { types, urgency, status, posted, from, to, area, q } = params
  return { types, urgency, status, posted, from, to, area, q }
}

/** True when a filter differs from its default (drives "Clear all"). */
export function hasActiveFilters(filters: ExplorerFilters): boolean {
  return (
    filters.types.length > 0 ||
    filters.urgency.length > 0 ||
    !sameList([...filters.status].sort(), DEFAULT_FILTERS.status) ||
    filters.posted !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.area !== null ||
    filters.q !== ''
  )
}

/** GET /api/requests query (decisions #8, #24). bbox = minLng,minLat,maxLng,maxLat. */
export type SearchQuery = {
  bbox?: string
  blood_type?: BloodType[]
  urgency?: Urgency[]
  status?: PublicStatus[]
  posted_after?: string
  posted_before?: string
  province?: Province
  q?: string
  sort?: Sort
  page?: number
}

export function toSearchQuery(
  filters: ExplorerFilters,
  options: { sort?: Sort; page?: number; bbox?: string | null } = {},
  today = manilaToday(),
): SearchQuery {
  const query: SearchQuery = {}
  if (options.bbox) query.bbox = options.bbox
  if (filters.types.length) query.blood_type = filters.types
  if (filters.urgency.length) query.urgency = filters.urgency
  if (!sameList([...filters.status].sort(), DEFAULT_FILTERS.status)) query.status = filters.status
  if (filters.posted) query.posted_after = shiftDate(today, -(POSTED_DAYS[filters.posted] - 1))
  if (filters.from) query.posted_after = filters.from
  if (filters.to) query.posted_before = filters.to
  if (filters.area && filters.area !== 'near') query.province = AREA_PROVINCE[filters.area]
  if (filters.q) query.q = filters.q
  if (options.sort && options.sort !== DEFAULT_PARAMS.sort) query.sort = options.sort
  if (options.page && options.page > 1) query.page = options.page
  return query
}

/** bbox rounded to 2 dp to improve cache hits (55:191). */
export function bboxKey(bounds: { west: number; south: number; east: number; north: number }): string {
  const r = (n: number, mode: 'floor' | 'ceil') => (Math[mode](n * 100) / 100).toFixed(2)
  return [r(bounds.west, 'floor'), r(bounds.south, 'floor'), r(bounds.east, 'ceil'), r(bounds.north, 'ceil')].join(',')
}

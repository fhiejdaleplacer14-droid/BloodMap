import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import { MAX_PUBLIC_ZOOM } from '../../lib/explorer/params'

/**
 * Leaflet + OpenStreetMap. Development uses tile.openstreetmap.org; production
 * needs a provider whose terms allow the traffic (decisions: open items).
 */
export const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Attribution stays visible at all times (non-negotiable). */
export const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Public users never zoom past 13, so an area can't be read as a point (55:248). */
export const MAX_ZOOM = MAX_PUBLIC_ZOOM
export const MIN_ZOOM = 7

/** Negros Island Region: Negros + Siquijor. */
export const NIR_BOUNDS: LatLngBoundsExpression = [
  [8.95, 122.3],
  [11.05, 123.75],
]

/** Panning stops a little beyond the region. */
export const MAX_BOUNDS: LatLngBoundsExpression = [
  [8.2, 121.4],
  [11.8, 124.6],
]

/** Approximate area around a municipality centroid (51:364, decision #5). */
export const AREA_RADIUS_M = 2500

/** Below this zoom a 2.5 km circle is only a few pixels wide. */
export const AREA_MIN_ZOOM = 10

/** Map pan / zoom → URL + refetch after 300 ms (55:206). */
export const VIEW_DEBOUNCE_MS = 300

/** Cluster when markers sit within 48 px (55:227). */
export const CLUSTER_RADIUS_PX = 48

/** [lng, lat] from the API → Leaflet [lat, lng]. */
export function toLatLng(point: [number, number]): LatLngTuple {
  return [point[1], point[0]]
}

/** "Ease to the request's generalized area at zoom ≤ 12" (55:220). */
export const FOCUS_ZOOM = 12

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

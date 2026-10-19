import L from 'leaflet'

/*
 * Map Marker (9:254) as L.divIcon markup. Request = blood-type label pinned to
 * a generalized point; Cluster = ink count (never red, so density never reads
 * as urgency); Facility = authorized coordination point. Leaflet makes each
 * marker a focusable role="button"; the accessible name comes from the
 * visually hidden text, e.g. "O positive request BM-2026-0012, San Carlos City".
 */

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Zero-size anchor at the point; the visible marker is positioned by CSS. */
const ANCHORED = { iconSize: [0, 0] as L.PointTuple, iconAnchor: [0, 0] as L.PointTuple }

export function requestIcon(label: string, accessibleName: string, selected: boolean): L.DivIcon {
  return L.divIcon({
    ...ANCHORED,
    className: 'bm-marker-host',
    html:
      `<span class="bm-marker" data-selected="${selected}">` +
      `<span class="bm-marker__label" aria-hidden="true">${escape(label)}</span>` +
      `<span class="bm-marker__tail" aria-hidden="true"></span>` +
      `<span class="sr-only">${escape(accessibleName)}</span>` +
      `</span>`,
  })
}

export function clusterIcon(count: number, accessibleName: string): L.DivIcon {
  return L.divIcon({
    iconSize: [40, 40],
    className: 'bm-marker-host',
    html:
      `<span class="bm-cluster"><span aria-hidden="true">${count}</span>` +
      `<span class="sr-only">${escape(accessibleName)}</span></span>`,
  })
}

/** lucide "building-2" (Icon/building, 3:186). */
const BUILDING_SVG =
  '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/>' +
  '<path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/>' +
  '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg>'

/**
 * Facility markers sit at the desk's published location. Demo desks share
 * their municipality's centroid with request labels, so the tile is drawn
 * beside the point (coordinates unchanged).
 */
export function facilityIcon(accessibleName: string): L.DivIcon {
  return L.divIcon({
    ...ANCHORED,
    className: 'bm-marker-host',
    html:
      `<span class="bm-facility">` +
      `<span class="bm-facility__tile">${BUILDING_SVG}</span>` +
      `<span class="bm-marker__tail bm-marker__tail--ink" aria-hidden="true"></span>` +
      `<span class="sr-only">${escape(accessibleName)}</span></span>`,
  })
}

export function captionIcon(text: string): L.DivIcon {
  return L.divIcon({
    ...ANCHORED,
    className: 'bm-marker-host bm-marker-host--static',
    html: `<span class="bm-caption" aria-hidden="true">${escape(text)}</span>`,
  })
}

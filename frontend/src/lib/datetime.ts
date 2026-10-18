import { differenceInHours, differenceInMinutes } from 'date-fns'

/** All timestamps are stored in UTC and displayed in Asia/Manila (55:386). */
export const DISPLAY_TIME_ZONE = 'Asia/Manila'

type Parts = { month: string; day: string; year: string; hour: string; minute: string }

function parts(iso: string, locale: string): Parts {
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: DISPLAY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => formatted.find((p) => p.type === type)?.value ?? ''
  return { month: get('month'), day: get('day'), year: get('year'), hour: get('hour'), minute: get('minute') }
}

/** "Oct 18" */
export function formatShortDate(iso: string, locale = 'en'): string {
  const p = parts(iso, locale)
  return `${p.month} ${p.day}`
}

/** "Oct 18, 2026" */
export function formatDate(iso: string, locale = 'en'): string {
  const p = parts(iso, locale)
  return `${p.month} ${p.day}, ${p.year}`
}

/** "17:00" */
export function formatTime(iso: string, locale = 'en'): string {
  const p = parts(iso, locale)
  return `${p.hour}:${p.minute}`
}

/** "Oct 18 · 17:00" — the design's compact date-time (9:487). */
export function formatShortDateTime(iso: string, locale = 'en'): string {
  return `${formatShortDate(iso, locale)} · ${formatTime(iso, locale)}`
}

/** Absolute time for tooltips: "Oct 18, 2026 · 17:00 PHT". */
export function formatAbsolute(iso: string, locale = 'en'): string {
  return `${formatDate(iso, locale)} · ${formatTime(iso, locale)} PHT`
}

export type Freshness = 'fresh' | 'aging' | 'stale'

/** Fresh < 24 h, Aging 24–72 h, Stale > 72 h (8:345). */
export function freshnessOf(updatedAt: string, now: Date = new Date()): Freshness {
  const hours = differenceInHours(now, new Date(updatedAt))
  if (hours < 24) return 'fresh'
  if (hours <= 72) return 'aging'
  return 'stale'
}

export type Elapsed = { unit: 'justNow' | 'minutes' | 'hours' | 'days'; count: number }

export function elapsedSince(iso: string, now: Date = new Date()): Elapsed {
  const minutes = Math.max(0, differenceInMinutes(now, new Date(iso)))
  if (minutes < 1) return { unit: 'justNow', count: 0 }
  if (minutes < 60) return { unit: 'minutes', count: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hours', count: hours }
  return { unit: 'days', count: Math.floor(hours / 24) }
}

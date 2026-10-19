import { useSyncExternalStore } from 'react'

/*
 * Device-only privacy settings (Profile · Privacy, 29:1153). They live in
 * this browser's storage and are never sent to the API.
 */

const KEYS = {
  recentlyViewed: 'bloodmap.recentlyViewed',
  keepRecent: 'bloodmap.keepRecentlyViewed',
  locationSort: 'bloodmap.locationSort',
} as const

const MAX_RECENT = 6
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode): the setting simply doesn't persist.
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => event.key?.startsWith('bloodmap.') && listener()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// Snapshots must be referentially stable between changes.
let recentCache: { raw: string | null; ids: string[] } = { raw: null, ids: [] }
function recentSnapshot(): string[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEYS.recentlyViewed)
  } catch {
    raw = null
  }
  if (raw !== recentCache.raw) recentCache = { raw, ids: raw ? (JSON.parse(raw) as string[]) : [] }
  return recentCache.ids
}

export const devicePrefs = {
  keepRecentlyViewed: () => read(KEYS.keepRecent, true),
  setKeepRecentlyViewed(value: boolean) {
    write(KEYS.keepRecent, value)
    if (!value) write(KEYS.recentlyViewed, [])
  },
  locationSort: () => read(KEYS.locationSort, false),
  setLocationSort: (value: boolean) => write(KEYS.locationSort, value),
  recordView(id: string) {
    if (!devicePrefs.keepRecentlyViewed()) return
    const ids = [id, ...recentSnapshot().filter((existing) => existing !== id)].slice(0, MAX_RECENT)
    write(KEYS.recentlyViewed, ids)
  },
  clearRecentlyViewed: () => write(KEYS.recentlyViewed, []),
}

export function useRecentlyViewed(): string[] {
  return useSyncExternalStore(subscribe, recentSnapshot, () => [])
}

export function useDevicePref(name: 'keepRecentlyViewed' | 'locationSort'): boolean {
  return useSyncExternalStore(subscribe, devicePrefs[name], () => name === 'keepRecentlyViewed')
}

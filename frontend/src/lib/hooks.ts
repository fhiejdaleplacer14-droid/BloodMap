import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Tailwind breakpoints (55:252): sm 640 · md 768 · lg 1024 · xl 1280. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

export function useMinWidth(breakpoint: keyof typeof BREAKPOINTS): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`)
}

/** Latest-callback debounce; pending calls are dropped on unmount. */
export function useDebouncedCallback<A extends unknown[]>(callback: (...args: A) => void, delay: number) {
  const latest = useRef(callback)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    latest.current = callback
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  return useCallback(
    (...args: A) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => latest.current(...args), delay)
    },
    [delay],
  )
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange)
      window.addEventListener('offline', onChange)
      return () => {
        window.removeEventListener('online', onChange)
        window.removeEventListener('offline', onChange)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

export type Coordinates = { lat: number; lng: number }

/**
 * Browser geolocation, requested only when `enabled`. The position stays in
 * memory — it is never stored, put in the URL or sent to the API (25:643).
 */
export function useGeolocation(enabled: boolean) {
  const [state, setState] = useState<{ coords: Coordinates | null; error: boolean }>({ coords: null, error: false })

  useEffect(() => {
    if (!enabled || state.coords || !('geolocation' in navigator)) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!cancelled) setState({ coords: { lat: position.coords.latitude, lng: position.coords.longitude }, error: false })
      },
      () => {
        if (!cancelled) setState({ coords: null, error: true })
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 },
    )
    return () => {
      cancelled = true
    }
  }, [enabled, state.coords])

  return state
}

/** One-shot geolocation for "Use my location" buttons. */
export function locateOnce(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 },
    )
  })
}

/** Great-circle distance in km (Near me sorting, in the browser only). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

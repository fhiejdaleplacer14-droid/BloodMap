import { useSyncExternalStore } from 'react'

export type Snap = 'peek' | 'half' | 'full'
export const ORDER: Snap[] = ['peek', 'half', 'full']

/** Peek is the frame's 301 px (25:483); full leaves the 56 px top bar visible. */
const PEEK = 300

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

function useViewportHeight() {
  return useSyncExternalStore(subscribe, () => window.innerHeight, () => 844)
}

/** Height in px of each snap point for the current viewport. */
export function useSnapHeights(): Record<Snap, number> {
  const vh = useViewportHeight()
  return { peek: Math.min(PEEK, vh - 160), half: Math.round(vh * 0.55), full: vh - 56 }
}

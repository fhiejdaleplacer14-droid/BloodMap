import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { ORDER, useSnapHeights, type Snap } from './sheetHeights'

type MapSheetProps = {
  snap: Snap
  onSnapChange: (snap: Snap) => void
  /** "8 requests in view" — shown while peeking. */
  summary: ReactNode
  /** One card while peeking (the tapped marker's request, or the first). */
  peek: ReactNode
  /** The full results list for half / full. */
  list: ReactNode
}

/**
 * Mobile / Map + bottom sheet (25:323): peek · half · full. Drag the header
 * to resize (snaps to the nearest point); the handle is also a button that
 * steps through the sizes for keyboard and switch users.
 */
export function MapSheet({ snap, onSnapChange, summary, peek, list }: MapSheetProps) {
  const { t } = useTranslation('explorer')
  const heights = useSnapHeights()
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)
  const height = dragHeight ?? heights[snap]

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { startY: event.clientY, startHeight: heights[snap], moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const dy = event.clientY - state.startY
    // Capture only once it's a drag, so a tap on the handle still clicks it.
    if (!state.moved && Math.abs(dy) > 6) {
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (state.moved) setDragHeight(Math.max(heights.peek * 0.6, Math.min(heights.full, state.startHeight - dy)))
  }
  const onPointerUp = () => {
    const state = drag.current
    drag.current = null
    if (!state?.moved || dragHeight === null) return setDragHeight(null)
    const nearest = ORDER.reduce((best, s) => (Math.abs(heights[s] - dragHeight) < Math.abs(heights[best] - dragHeight) ? s : best), snap)
    setDragHeight(null)
    onSnapChange(nearest)
  }

  const next = ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]

  return (
    <section
      aria-label={t('sheet.label')}
      className={cn(
        'absolute inset-x-0 bottom-0 z-1000 flex flex-col rounded-t-2xl border-t border-default bg-surface shadow-overlay',
        dragHeight === null && 'transition-[height] duration-200 motion-reduce:transition-none',
      )}
      style={{ height }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 cursor-grab touch-none px-4 pt-2 pb-3 active:cursor-grabbing"
      >
        <button
          type="button"
          aria-expanded={snap !== 'peek'}
          aria-label={next === 'peek' ? t('sheet.collapse') : t('sheet.expand')}
          onClick={() => onSnapChange(next)}
          className="mx-auto flex h-4 w-16 items-start justify-center rounded-sm"
        >
          <span aria-hidden className="h-1 w-9 rounded-full bg-(--border-strong)" />
        </button>
        {snap === 'peek' && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="type-label-m text-primary">{summary}</p>
            <p aria-hidden className="type-body-s text-secondary">
              {t('sheet.swipe')}
            </p>
          </div>
        )}
      </div>
      {snap === 'peek' ? <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">{peek}</div> : <div className="flex min-h-0 flex-1 flex-col">{list}</div>}
    </section>
  )
}

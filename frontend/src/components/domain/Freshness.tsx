import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { elapsedSince, formatAbsolute, freshnessOf, type Freshness as Level } from '../../lib/datetime'
import { Tooltip } from '../ui/Tooltip'

const DOT: Record<Level, string> = {
  fresh: 'bg-(--status-success-fg)',
  aging: 'bg-(--status-warning-fg)',
  stale: 'bg-(--status-neutral-fg)',
}

type FreshnessProps = {
  /** request.updated_at (ISO, UTC). */
  updatedAt: string
  /** Override the relative text (e.g. "Closed Oct 13"). */
  label?: string
  /** Force a level (e.g. receded cards are always stale). */
  level?: Level
  now?: Date
  /** Off inside links/cards, where a focusable tooltip would nest interactives. */
  tooltip?: boolean
  className?: string
}

/**
 * Freshness (8:345): Fresh < 24 h · Aging 24–72 h · Stale > 72 h. The dot is
 * decorative — the text carries meaning. <time> with the absolute PHT time
 * in a tooltip (hover and focus).
 */
export function Freshness({ updatedAt, label, level, now, tooltip = true, className }: FreshnessProps) {
  const { t, i18n } = useTranslation()
  const resolved = level ?? freshnessOf(updatedAt, now)
  const elapsed = elapsedSince(updatedAt, now)
  const absolute = formatAbsolute(updatedAt, i18n.language)
  const text = label ?? t(`time.updated.${elapsed.unit}`, { count: elapsed.count })

  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[resolved])} />
      {tooltip ? (
        <Tooltip content={absolute}>
          <time dateTime={updatedAt} tabIndex={0} className="type-mono-s rounded-xs whitespace-nowrap text-secondary">
            {text}
          </time>
        </Tooltip>
      ) : (
        <time dateTime={updatedAt} title={absolute} className="type-mono-s whitespace-nowrap text-secondary">
          {text}
        </time>
      )}
    </span>
  )
}

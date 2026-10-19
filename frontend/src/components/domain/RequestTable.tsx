import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { elapsedSince, formatAbsolute, formatDate, formatShortDateTime } from '../../lib/datetime'
import type { BloodType, RequestStatus } from '../../lib/request'
import { BloodTypeTag } from './BloodTypeTag'
import { StatusBadge } from './StatusBadge'

/** Columns of the request table (9:489). Owner / coordinator views. */
export type RequestRow = {
  id: string
  blood_type: BloodType
  municipality: string
  created_at: string
  expires_at: string | null
  status: RequestStatus
  updated_at: string
}

type RequestTableProps = {
  rows: RequestRow[]
  /** Accessible table caption (can be visually hidden). */
  caption: string
  selectedId?: string
  onRowClick?: (id: string) => void
  /**
   * Row actions menu (⋯). Only actions the API's `can` flags allow are
   * passed in — render nothing when the user may not act.
   */
  renderActions?: (row: RequestRow) => ReactNode
  now?: Date
  className?: string
}

const COLUMNS = [
  ['id', 'w-35'],
  ['type', 'w-18'],
  ['location', 'w-45'],
  ['created', 'w-30'],
  ['expires', 'w-35'],
  ['status', 'w-39'],
  ['updated', 'w-30'],
] as const

const cell = 'h-13 px-3 align-middle'

const INACTIVE: ReadonlySet<RequestStatus> = new Set(['fulfilled', 'closed', 'expired', 'rejected'])

/**
 * Table Header Row + Request Table Row (9:489 · 9:585). 52 px rows; IDs and
 * timestamps in JetBrains Mono. Hover = bg/canvas, selected = bg/brand-soft.
 * Sticky header.
 */
export function RequestTable({ rows, caption, selectedId, onRowClick, renderActions, now, className }: RequestTableProps) {
  const { t, i18n } = useTranslation('request')
  const { t: tc } = useTranslation()
  const locale = i18n.language

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-default', className)}>
      <table className="w-full min-w-246 border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-default bg-subtle">
            {COLUMNS.map(([key, width]) => (
              <th key={key} scope="col" className={cn('type-overline h-10 px-3 font-semibold text-secondary', width)}>
                {t(`table.${key}`)}
              </th>
            ))}
            <th scope="col" className="w-14 px-3">
              <span className="sr-only">{t('table.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const updated = elapsedSince(row.updated_at, now)
            // Inactive rows recede (28:733): 50 % tag, 70 % text, never read as live.
            const inactive = INACTIVE.has(row.status)
            return (
              <tr
                key={row.id}
                aria-selected={row.id === selectedId || undefined}
                onClick={onRowClick ? () => onRowClick(row.id) : undefined}
                className={cn(
                  'border-b border-default transition-colors duration-150 last:border-b-0',
                  row.id === selectedId ? 'bg-brand-soft' : 'bg-surface hover:bg-canvas',
                  onRowClick && 'cursor-pointer',
                )}
              >
                <th scope="row" className={cn(cell, 'type-mono-m font-medium text-primary')}>
                  {row.id}
                </th>
                <td className={cell}>
                  <BloodTypeTag type={row.blood_type} size="sm" dimmed={inactive} />
                </td>
                <td className={cn(cell, 'type-body-m max-w-45 truncate text-primary', inactive && 'opacity-70')}>{row.municipality}</td>
                <td className={cn(cell, 'type-mono-s text-secondary', inactive && 'opacity-70')}>
                  <time dateTime={row.created_at}>{formatDate(row.created_at, locale)}</time>
                </td>
                <td className={cn(cell, 'type-mono-s text-secondary', inactive && 'opacity-70')}>
                  {row.expires_at ? <time dateTime={row.expires_at}>{formatShortDateTime(row.expires_at, locale)}</time> : '—'}
                </td>
                <td className={cell}>
                  <StatusBadge status={row.status} />
                </td>
                <td className={cn(cell, 'type-mono-s text-secondary', inactive && 'opacity-70')}>
                  <time dateTime={row.updated_at} title={formatAbsolute(row.updated_at, locale)}>
                    {tc(`time.ago.${updated.unit}`, { count: updated.count })}
                  </time>
                </td>
                <td className={cn(cell, 'w-14 text-center')} onClick={(event) => event.stopPropagation()}>
                  {renderActions?.(row)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

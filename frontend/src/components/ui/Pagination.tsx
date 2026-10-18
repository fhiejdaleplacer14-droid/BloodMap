import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { icons } from './icons'

const ChevronLeft = icons['chevron-left']
const ChevronRight = icons['chevron-right']

/** Laravel paginator meta. */
export type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type PaginationProps = {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  className?: string
}

/** 1 … around current … last, e.g. 1 2 3 … 5 (8:204). */
function pageItems(current: number, last: number): Array<number | 'gap'> {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last))
  if (current <= 3) [2, 3].forEach((p) => p <= last && pages.add(p))
  if (current >= last - 2) [last - 1, last - 2].forEach((p) => p >= 1 && pages.add(p))
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((page, i) => (i > 0 && page - sorted[i - 1] > 1 ? ['gap' as const, page] : [page]))
}

const box =
  'type-label-m inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:cursor-not-allowed disabled:text-tertiary disabled:hover:bg-transparent'
const idle = 'border border-default text-primary hover:bg-subtle'

/**
 * Pagination (8:204). Server-side (Laravel meta). Current page carries
 * aria-current="page". Below 640 px it collapses to Prev · "Page 1 of 5" · Next.
 */
export function Pagination({ meta, onPageChange, className }: PaginationProps) {
  const { t } = useTranslation()
  const { current_page: page, last_page: last, per_page: perPage, total } = meta
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  const prev = (
    <button type="button" className={cn(box, idle)} aria-label={t('pagination.previous')} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
      <ChevronLeft aria-hidden size={16} />
    </button>
  )
  const next = (
    <button type="button" className={cn(box, idle)} aria-label={t('pagination.next')} disabled={page >= last} onClick={() => onPageChange(page + 1)}>
      <ChevronRight aria-hidden size={16} />
    </button>
  )

  return (
    <nav aria-label={t('pagination.label')} className={cn('flex h-10 items-center justify-between gap-4', className)}>
      <p className="type-body-s text-secondary max-sm:hidden">{t('pagination.summary', { from, to, total })}</p>

      <div className="flex w-full items-center justify-between gap-2 sm:hidden">
        {prev}
        <span className="type-label-m text-primary">{t('pagination.pageOf', { page, last })}</span>
        {next}
      </div>

      <ul className="flex items-center gap-1 max-sm:hidden">
        <li>{prev}</li>
        {pageItems(page, last).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden className={cn(box, 'border border-default text-primary')}>
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                aria-label={t('pagination.page', { page: item })}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={cn(box, item === page ? 'bg-inverse text-on-inverse' : idle)}
              >
                {item}
              </button>
            </li>
          ),
        )}
        <li>{next}</li>
      </ul>
    </nav>
  )
}

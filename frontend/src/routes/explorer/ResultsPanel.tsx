import type { ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { RequestCard } from '../../components/domain/RequestCard'
import { SkeletonRequestCard } from '../../components/domain/SkeletonRequestCard'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Pagination, type PaginationMeta } from '../../components/ui/Pagination'
import { cn } from '../../lib/cn'
import { formatTime } from '../../lib/datetime'
import { SORTS, type Sort } from '../../lib/explorer/params'
import type { PublicRequest } from '../../lib/request'

const ChevronDown = icons['chevron-down']
const WifiOff = icons['wifi-off']

type ResultsPanelProps = {
  items: PublicRequest[]
  meta: PaginationMeta | null
  /** First load: no results to show yet. */
  initialLoading: boolean
  /** The last refresh failed (or we're offline) — previous results stay. */
  stale: boolean
  /** No results at all could be loaded. */
  failed: boolean
  lastUpdated: number | null
  onRetry: () => void
  sort: Sort
  nearMe: boolean
  onSortChange: (sort: Sort) => void
  onPageChange: (page: number) => void
  onClearAll: () => void
  hrefFor: (id: string) => string
  selectedId: string | null
  highlightedId: string | null
  onHighlight: (id: string | null) => void
  /** Beside the count, e.g. "Sample data" on phones (25:116). */
  badge?: ReactNode
  /**
   * Phones and the map sheet: the privacy note scrolls with the list and the
   * list leaves room for the guide launcher.
   */
  compact?: boolean
}

/** Results bar · Results list · Privacy note (14:107 → 14:373). */
export function ResultsPanel({
  items,
  meta,
  initialLoading,
  stale,
  failed,
  lastUpdated,
  onRetry,
  sort,
  nearMe,
  onSortChange,
  onPageChange,
  onClearAll,
  hrefFor,
  selectedId,
  highlightedId,
  onHighlight,
  badge,
  compact = false,
}: ResultsPanelProps) {
  const { t, i18n } = useTranslation(['explorer', 'states'])
  const asOf = lastUpdated ? formatTime(new Date(lastUpdated).toISOString(), i18n.language) : null
  const total = meta?.total ?? 0

  const privacyNote = (
        <div className="flex gap-2 border-t border-default bg-canvas px-6 py-3 max-sm:px-4">
          <icons.info aria-hidden size={16} className="mt-px shrink-0 text-secondary" />
          <p className="type-body-s text-secondary">{t('results.privacyNote')}</p>
        </div>
  )

  return (
    <>
      {stale && !failed && (
        // Inline error · refresh failed (19:1828).
        <div role="alert" className="flex items-center gap-2.5 bg-status-critical px-6 py-3 max-sm:px-4">
          <WifiOff aria-hidden size={18} className="shrink-0 text-status-critical" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-status-critical">
            <p className="type-label-m">{t('results.refreshFailed')}</p>
            {asOf && <p className="type-body-s">{t('results.showingFrom', { time: asOf })}</p>}
          </div>
          <Button variant="secondary" icon="refresh" onClick={onRetry}>
            {t('results.retry')}
          </Button>
        </div>
      )}

      {!failed && (
        <div className="flex items-center justify-between gap-3 px-6 py-3 max-sm:px-4">
          <p className="flex items-center gap-1.5 whitespace-nowrap" aria-live="polite" aria-atomic="true">
            {initialLoading ? (
              <span className="type-label-m text-secondary">{t('map.loading')}</span>
            ) : (
              <>
                <span className="type-label-m text-primary">{t('results.count', { count: total })}</span>
                {stale && asOf ? (
                  <span className="type-body-s text-secondary">{t('results.asOf', { time: asOf })}</span>
                ) : badge ? (
                  badge
                ) : (
                  <span className="type-body-s text-secondary">{t('results.inView')}</span>
                )}
              </>
            )}
          </p>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className="flex items-center gap-1 rounded-sm whitespace-nowrap"
            >
              <span className="type-body-s text-secondary">{t('results.sort')}</span>
              <span className="type-label-m text-primary">{t(`results.sorts.${nearMe ? 'nearest' : sort}`)}</span>
              <ChevronDown aria-hidden size={16} className="text-secondary" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-40 min-w-52 rounded-lg border border-default bg-surface p-1 shadow-overlay"
              >
                <DropdownMenu.RadioGroup value={nearMe ? 'nearest' : sort} onValueChange={(value) => onSortChange(value as Sort)}>
                  {SORTS.map((option) => (
                    <DropdownMenu.RadioItem
                      key={option}
                      value={option}
                      className="type-body-m flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-primary outline-none data-highlighted:bg-subtle"
                    >
                      {t(`results.sorts.${option}`)}
                      <DropdownMenu.ItemIndicator>
                        <icons.check aria-hidden size={16} />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}

      <div
        id="explorer-results"
        tabIndex={-1}
        aria-busy={initialLoading || undefined}
        aria-label={t('results.listLabel')}
        className={cn(
          'relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto outline-none',
          compact ? 'px-4 pb-24' : 'px-6 pb-4 max-sm:px-4',
        )}
      >
        {failed ? (
          <EmptyState
            role="alert"
            tone="critical"
            icon="wifi-off"
            title={t('states:networkError.title')}
            description={t('states:networkError.body')}
            actions={
              <Button variant="secondary" icon="refresh" onClick={onRetry}>
                {t('states:networkError.action')}
              </Button>
            }
          />
        ) : initialLoading ? (
          <>
            <SkeletonRequestCard />
            <SkeletonRequestCard />
            <SkeletonRequestCard />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon="search"
            title={t('states:noResults.title')}
            description={t('states:noResults.body')}
            actions={
              <Button variant="secondary" onClick={onClearAll}>
                {t('states:noResults.action')}
              </Button>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {items.map((request) => (
                <li key={request.id}>
                  <RequestCard
                    id={`request-card-${request.id}`}
                    request={request}
                    to={hrefFor(request.id)}
                    selected={request.id === selectedId || request.id === highlightedId}
                    onHighlight={onHighlight}
                  />
                </li>
              ))}
            </ul>
            {meta && meta.last_page > 1 && <Pagination meta={meta} onPageChange={onPageChange} className="mt-2" />}
          </>
        )}
        {compact && !failed && <div className="-mx-4 mt-2">{privacyNote}</div>}
      </div>

      {!compact && privacyNote}
    </>
  )
}

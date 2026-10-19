import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { RequestTable } from '../../components/domain/RequestTable'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Pagination } from '../../components/ui/Pagination'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tab, Tabs, TabsList } from '../../components/ui/Tabs'
import { toast } from '../../components/ui/toast'
import { api } from '../../lib/api/client'
import { QUEUE_TABS, useQueue, useReviewAction, type ListTab, type QueueTab } from '../../lib/api/coordinator'
import type { ManagedRequest } from '../../lib/api/myRequests'
import { cn } from '../../lib/cn'
import { formatShortDateTime } from '../../lib/datetime'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { reviewHref } from './coordText'

const PER_PAGE = 20

/** Coordinator / Review Queue (35:462 · 35:698). Oldest first; corrections keep their place. */
export function QueuePage() {
  const { t } = useTranslation(['coord', 'states'])
  useDocumentTitle(t('queue.title'))
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: QueueTab = QUEUE_TABS.includes(tabParam as QueueTab) ? (tabParam as QueueTab) : 'unassigned'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const queue = useQueue(tab, page)
  const assign = useReviewAction()

  const assignNext = async () => {
    try {
      const { data } = await api.get<{ data: ManagedRequest[] }>('/api/coordinator/queue', { params: { tab: 'unassigned' } })
      const next = data.data[0]
      if (!next) return toast({ tone: 'info', title: t('queue.nothingToAssign') })
      const assigned = await assign.mutateAsync({ id: next.id, action: 'assign' })
      toast({ tone: 'success', title: t('queue.assigned'), message: t('queue.assignedBody', { id: assigned.id }) })
      navigate(reviewHref(assigned.id))
    } catch {
      toast({ tone: 'error', title: t('review.failed'), message: t('review.failedBody') })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('queue.title')}
        subtitle={t('queue.subtitle')}
        actions={
          <Button variant="secondary" onClick={() => void assignNext()} loading={assign.isPending} title={t('queue.assignNextHelp')}>
            {t('queue.assignNext')}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setParams(value === 'unassigned' ? {} : { tab: value }, { replace: true })}>
        <TabsList aria-label={t('queue.caption')}>
          {QUEUE_TABS.map((key) => (
            <Tab key={key} value={key} count={queue.data?.counts[key]}>
              {t(`queue.tabs.${key}`)}
            </Tab>
          ))}
        </TabsList>
      </Tabs>

      <QueueBody tab={tab} query={queue} onPage={(p) => setParams({ ...(tab !== 'unassigned' && { tab }), page: String(p) })} />

      <p className="type-body-s flex items-center gap-2 text-secondary">
        <icons.info aria-hidden size={16} className="shrink-0" />
        {t('queue.note')}
      </p>
    </div>
  )
}

function QueueBody({ tab, query, onPage }: { tab: QueueTab; query: ReturnType<typeof useQueue>; onPage: (page: number) => void }) {
  const { t, i18n } = useTranslation(['coord', 'request', 'states'])
  const navigate = useNavigate()
  if (query.isPending) return <Skeleton className="h-64 w-full rounded-lg" />
  if (query.isError) {
    return (
      <EmptyState
        role="alert"
        tone="critical"
        icon="wifi-off"
        title={t('states:networkError.title')}
        description={t('states:networkError.body')}
        actions={
          <Button variant="secondary" icon="refresh" onClick={() => void query.refetch()}>
            {t('states:networkError.action')}
          </Button>
        }
      />
    )
  }
  const { data: rows, meta } = query.data
  if (rows.length === 0) return <EmptyState icon="clipboard-check" title={t('queue.emptyTitle')} description={t(`queue.empty.${tab}`)} actions={null} />

  const head = 'type-overline h-10 px-3 text-left font-semibold whitespace-nowrap text-secondary'
  const cell = 'h-13 px-3 align-middle'
  return (
    <>
      <div className={cn('overflow-x-auto rounded-lg border border-default', query.isPlaceholderData && 'opacity-60')}>
        <table className="w-full min-w-215 border-collapse">
          <caption className="sr-only">{t('queue.caption')}</caption>
          <thead className="sticky top-0 bg-subtle">
            <tr>
              {(['id', 'type', 'submitted', 'location', 'submitter', 'status', 'assigned'] as const).map((key) => (
                <th key={key} scope="col" className={head}>
                  {t(`queue.columns.${key}`)}
                </th>
              ))}
              <th scope="col" className={head}>
                <span className="sr-only">{t('queue.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const correction = r.status === 'needs_correction'
              return (
                <tr
                  key={r.id}
                  onClick={() => navigate(reviewHref(r.id))}
                  className="cursor-pointer border-t border-default bg-surface hover:bg-canvas"
                >
                  <th scope="row" className={cn(cell, 'type-mono-s text-left font-normal whitespace-nowrap text-primary')}>
                    {r.id}
                  </th>
                  <td className={cell}>
                    <BloodTypeTag type={r.blood_type} size="sm" />
                  </td>
                  <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                    {formatShortDateTime(r.first_submitted_at ?? r.submitted_at ?? r.created_at, i18n.language)}
                  </td>
                  <td className={cn(cell, 'type-body-m text-primary')}>{r.location.municipality}</td>
                  <td className={cn(cell, 'type-body-m whitespace-nowrap text-primary')}>
                    {t('queue.submitter', { reference: r.submitter?.reference ?? '—' })}
                  </td>
                  <td className={cell}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={cn(cell, 'whitespace-nowrap')}>
                    {r.assigned_coordinator ? (
                      <span className="type-body-s inline-flex items-center gap-2 text-secondary">
                        <Avatar initials={r.assigned_coordinator.initials} />
                        {r.assigned_coordinator.is_me ? t('queue.you') : r.assigned_coordinator.name}
                      </span>
                    ) : (
                      <span className="type-body-s text-tertiary">{t('queue.unassigned')}</span>
                    )}
                  </td>
                  <td className={cn(cell, 'text-right whitespace-nowrap')}>
                    {correction ? (
                      <span className="type-body-s text-tertiary">{t('queue.waiting')}</span>
                    ) : (
                      <Button asChild variant="primary">
                        <Link to={reviewHref(r.id)} onClick={(e) => e.stopPropagation()}>
                          {t('queue.review')}
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-body-s text-secondary">
          {t('queue.summary', { from: (meta.current_page - 1) * PER_PAGE + 1, to: (meta.current_page - 1) * PER_PAGE + rows.length, total: meta.total })}
        </p>
        {meta.last_page > 1 && <Pagination meta={meta} onPageChange={onPage} />}
      </div>
    </>
  )
}

/** Sidebar "Active Requests" / "Closed Requests": no frames — the request table (9:489) scoped to the area. */
export function CoordListPage({ tab }: { tab: Extract<ListTab, 'active' | 'closed'> }) {
  const { t } = useTranslation(['coord', 'states'])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const list = useQueue(tab, page)
  const title = tab === 'active' ? t('lists.activeTitle') : t('lists.closedTitle')
  useDocumentTitle(title)

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader title={title} subtitle={tab === 'active' ? t('lists.activeSubtitle') : t('lists.closedSubtitle')} />
      {list.isPending ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : list.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void list.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : list.data.data.length === 0 ? (
        <EmptyState icon="list" title={t('queue.emptyTitle')} description={tab === 'active' ? t('lists.emptyActive') : t('lists.emptyClosed')} actions={null} />
      ) : (
        <>
          <RequestTable
            caption={title}
            className={cn(list.isPlaceholderData && 'opacity-60')}
            rows={list.data.data.map((r) => ({
              id: r.id,
              blood_type: r.blood_type,
              municipality: r.location.municipality,
              created_at: r.created_at,
              expires_at: r.expires_at,
              status: r.status,
              updated_at: r.updated_at,
            }))}
            onRowClick={(id) => navigate(reviewHref(id))}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="type-body-s text-secondary">
              {t('queue.summary', {
                from: (list.data.meta.current_page - 1) * PER_PAGE + 1,
                to: (list.data.meta.current_page - 1) * PER_PAGE + list.data.data.length,
                total: list.data.meta.total,
              })}
            </p>
            {list.data.meta.last_page > 1 && <Pagination meta={list.data.meta} onPageChange={(p) => setParams({ page: String(p) })} />}
          </div>
        </>
      )}
    </div>
  )
}

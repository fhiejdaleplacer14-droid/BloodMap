import { useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { RequestTable, type RequestRow } from '../../components/domain/RequestTable'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { DateField } from '../../components/ui/DateTimeField'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons, type IconName } from '../../components/ui/icons'
import { Pagination } from '../../components/ui/Pagination'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tab, Tabs, TabsList } from '../../components/ui/Tabs'
import { TextField } from '../../components/ui/TextField'
import { useMe } from '../../lib/api/auth'
import { MINE_TABS, useMyRequests, type ManagedRequest, type MineFilters, type MineTab } from '../../lib/api/myRequests'
import { cn } from '../../lib/cn'
import { isIsoDate } from '../../lib/dates'
import { useDebouncedCallback } from '../../lib/hooks'
import { BLOOD_TYPES, displayBloodType, REQUEST_STATUSES, type BloodType, type RequestStatus } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { CloseRequestDialog } from './CloseRequestDialog'
import { useOwnerActions } from './ownerActions'
import { EDITABLE_IN_WIZARD, wizardHref } from './requestForm'

const PER_PAGE = 20

const toRow = (r: ManagedRequest): RequestRow => ({
  id: r.id,
  blood_type: r.blood_type,
  municipality: r.location.municipality,
  created_at: r.created_at,
  expires_at: r.expires_at,
  status: r.status,
  updated_at: r.updated_at,
})

function readFilters(params: URLSearchParams, drafts: boolean): MineFilters {
  const status = params.get('status')
  const type = params.get('type')
  const after = params.get('after')
  const tab = params.get('tab')
  return {
    q: params.get('q') ?? undefined,
    status: drafts ? 'draft' : REQUEST_STATUSES.includes(status as RequestStatus) ? (status as RequestStatus) : undefined,
    blood_type: BLOOD_TYPES.includes(type as BloodType) ? (type as BloodType) : undefined,
    created_after: after && isIsoDate(after) ? after : undefined,
    tab: !drafts && MINE_TABS.includes(tab as MineTab) ? (tab as MineTab) : 'all',
    page: Math.max(1, Number(params.get('page')) || 1),
  }
}

const itemClass =
  'type-body-m flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-subtle'

/** Requests / My Requests (32:840) and Drafts (sidebar, 32:841). */
export function MyRequestsPage({ drafts = false }: { drafts?: boolean }) {
  const { t } = useTranslation(['manage', 'request', 'states'])
  const navigate = useNavigate()
  const me = useMe().data
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params, drafts)
  const list = useMyRequests(filters)
  const { run, closeDialog } = useOwnerActions()
  const [search, setSearch] = useState(filters.q ?? '')
  useDocumentTitle(drafts ? t('mine.draftsTitle') : t('mine.title'))

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }
  const pushSearch = useDebouncedCallback((value: string) => update({ q: value.trim() || undefined }), 300)

  const counts = list.data?.meta.counts
  const meta = list.data?.meta
  const rows = list.data?.data ?? []
  const filtered = Boolean(filters.q || (!drafts && filters.status) || filters.blood_type || filters.created_after)
  const desk = me?.coordination_point?.name

  const detailHref = (id: string) => `/requests/mine/${encodeURIComponent(id)}`
  const byId = new Map(rows.map((r) => [r.id, r]))

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={drafts ? t('mine.draftsTitle') : t('mine.title')}
        subtitle={drafts ? t('mine.draftsSubtitle') : desk ? t('mine.subtitle', { desk }) : t('mine.subtitleNoDesk')}
        actions={
          me?.permissions.includes('requests.create') && (
            <Button asChild variant="primary">
              <Link to="/requests/new">
                <icons.plus aria-hidden size={16} />
                {t('mine.create')}
              </Link>
            </Button>
          )
        }
      />

      <div role="search" className="flex flex-wrap items-end gap-3">
        <div className="w-72 max-sm:w-full">
          <TextField
            type="search"
            label={t('mine.search')}
            placeholder={t('mine.searchPlaceholder')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              pushSearch(event.target.value)
            }}
            onClear={() => {
              setSearch('')
              update({ q: undefined })
            }}
          />
        </div>
        {!drafts && (
          <div className="w-50 max-sm:w-full">
            <SelectField label={t('mine.status')} value={filters.status ?? ''} onChange={(event) => update({ status: event.target.value || undefined })}>
              <option value="">{t('mine.allStatuses')}</option>
              {REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`request:status.${status}`)}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <div className="w-36 max-sm:w-full">
          <SelectField label={t('mine.bloodType')} value={filters.blood_type ?? ''} onChange={(event) => update({ type: event.target.value || undefined })}>
            <option value="">{t('mine.anyType')}</option>
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type} aria-label={t(`request:bloodType.spoken.${type}`)}>
                {displayBloodType(type)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-44 max-sm:w-full">
          <DateField
            label={t('mine.createdAfter')}
            value={filters.created_after ?? ''}
            onChange={(event) => update({ after: event.target.value || undefined })}
          />
        </div>
      </div>

      {!drafts && (
        <Tabs value={filters.tab} onValueChange={(value) => update({ tab: value === 'all' ? undefined : value })}>
          <TabsList aria-label={t('mine.caption')}>
            {MINE_TABS.map((key) => (
              <Tab key={key} value={key} aria-controls="my-requests-results" count={counts?.[key]}>
                {t(`mine.tabs.${key}`)}
              </Tab>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div id="my-requests-results" className="flex flex-col gap-6">
      {list.isPending ? (
        <Skeleton className="h-80 w-full rounded-lg" />
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
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon="search"
            title={t('mine.empty.filteredTitle')}
            description={t('mine.empty.filteredBody')}
            actions={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('')
                  setParams({}, { replace: true })
                }}
              >
                {t('mine.empty.clear')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="file-text"
            title={drafts ? t('mine.empty.draftsTitle') : t('mine.empty.title')}
            description={drafts ? t('mine.empty.draftsBody') : t('mine.empty.body')}
            actions={
              me?.permissions.includes('requests.create') && (
                <Button asChild variant="secondary">
                  <Link to="/requests/new">{t('mine.create')}</Link>
                </Button>
              )
            }
          />
        )
      ) : (
        <>
          <RequestTable
            rows={rows.map(toRow)}
            caption={drafts ? t('mine.draftsTitle') : t('mine.caption')}
            onRowClick={(id) => navigate(detailHref(id))}
            className={cn(list.isPlaceholderData && 'opacity-60')}
            renderActions={(row) => {
              const request = byId.get(row.id)
              return request ? <RowMenu request={request} detailHref={detailHref(row.id)} run={run} /> : null
            }}
          />
          {meta && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="type-body-s text-secondary">
                {t('mine.summary', {
                  from: (meta.current_page - 1) * PER_PAGE + 1,
                  to: (meta.current_page - 1) * PER_PAGE + rows.length,
                  total: meta.total,
                })}
              </p>
              {meta.last_page > 1 && <Pagination meta={meta} onPageChange={(page) => update({ page: String(page) })} />}
            </div>
          )}
        </>
      )}
      </div>
      <CloseRequestDialog {...closeDialog} />
    </div>
  )
}

function RowMenu({
  request,
  detailHref,
  run,
}: {
  request: ManagedRequest
  detailHref: string
  run: ReturnType<typeof useOwnerActions>['run']
}) {
  const { t } = useTranslation(['manage', 'request'])
  const navigate = useNavigate()
  const editable = EDITABLE_IN_WIZARD.has(request.status) && request.can.update
  const item = (icon: IconName, label: string, onSelect: () => void, tone?: 'critical') => {
    const Icon = icons[icon]
    return (
      <DropdownMenu.Item onSelect={onSelect} className={cn(itemClass, tone === 'critical' ? 'text-status-critical' : 'text-primary')}>
        <Icon aria-hidden size={16} />
        {label}
      </DropdownMenu.Item>
    )
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('request:table.rowActions', { id: request.id })}
        className="flex size-8 items-center justify-center rounded-md text-secondary hover:bg-subtle"
      >
        <icons.more aria-hidden size={20} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 w-64 rounded-lg border border-default bg-surface p-1 shadow-overlay">
          {item('eye', t('actions.view'), () => navigate(detailHref))}
          {editable && item('pencil', request.status === 'draft' ? t('actions.continueDraft') : t('actions.edit'), () => navigate(wizardHref(request)))}
          {request.status === 'active' && (
            <DropdownMenu.Item disabled className="flex flex-col items-start gap-0.5 rounded-md px-3 py-2 outline-none">
              <span className="type-body-m flex items-center gap-2 text-tertiary">
                <icons.pencil aria-hidden size={16} />
                {t('actions.edit')}
              </span>
              <span className="type-body-s text-secondary">{t('actions.editLocked')}</span>
            </DropdownMenu.Item>
          )}
          {request.can.extend && item('calendar', t('actions.extend'), () => run.extend(request))}
          {request.can.fulfill && item('check-circle', t('actions.fulfill'), () => run.fulfill(request))}
          {request.can.close && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              {item('lock', t('actions.closeMenu'), () => run.close(request), 'critical')}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Sidebar "Drafts" (32:841): My Requests locked to draft status. */
export function DraftsPage() {
  return <MyRequestsPage drafts />
}

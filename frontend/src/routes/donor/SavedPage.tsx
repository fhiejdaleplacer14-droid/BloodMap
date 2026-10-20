import { useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { RequestTable, type RequestRow } from '../../components/domain/RequestTable'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Pagination } from '../../components/ui/Pagination'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tab, Tabs, TabsList } from '../../components/ui/Tabs'
import { toast } from '../../components/ui/toast'
import { useSavedRequests, useUnsave } from '../../lib/api/me'
import type { PublicRequest } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

type TabKey = 'all' | 'active' | 'inactive'
const PER_PAGE = 20

const toRow = (r: PublicRequest): RequestRow => ({
  id: r.id,
  blood_type: r.blood_type,
  municipality: r.location.municipality,
  created_at: r.published_at ?? r.updated_at,
  expires_at: r.expires_at,
  status: r.status,
  updated_at: r.updated_at,
})

/** Donor / Saved Requests (28:521). */
export function SavedPage() {
  const { t } = useTranslation(['workspace', 'states', 'common', 'explorer', 'request'])
  useDocumentTitle(t('crumbs.saved'))
  const navigate = useNavigate()
  const saved = useSavedRequests()
  const unsave = useUnsave()
  const [tab, setTab] = useState<TabKey>('all')
  const [page, setPage] = useState(1)

  const all = saved.data ?? []
  const lists: Record<TabKey, PublicRequest[]> = {
    all,
    active: all.filter((r) => r.status === 'active'),
    inactive: all.filter((r) => r.status !== 'active'),
  }
  const rows = lists[tab]
  const lastPage = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(toRow)

  const remove = (id: string) =>
    unsave.mutate(id, {
      onSuccess: () => toast({ tone: 'info', title: t('saved.removed') }),
      onError: () => toast({ tone: 'error', title: t('explorer:detail.saveFailed'), message: t('explorer:detail.saveFailedBody') }),
    })

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('saved.title')}
        subtitle={t('saved.subtitle')}
        actions={
          <Button asChild variant="primary">
            <Link to="/requests">
              <icons.search aria-hidden size={16} />
              {t('dashboard.explore')}
            </Link>
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as TabKey)
          setPage(1)
        }}
      >
        <TabsList aria-label={t('saved.caption')}>
          {(['all', 'active', 'inactive'] as const).map((key) => (
            <Tab key={key} value={key} aria-controls="saved-results" count={saved.data ? lists[key].length : undefined}>
              {t(`saved.tabs.${key}`)}
            </Tab>
          ))}
        </TabsList>
      </Tabs>

      <div id="saved-results" className="flex flex-col gap-6">
      {saved.isPending ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : saved.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void saved.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title={t('states:noSaved.title')}
          description={t('states:noSaved.body')}
          actions={
            <Button asChild variant="secondary">
              <Link to="/requests">{t('states:noSaved.action')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <RequestTable
            rows={pageRows}
            caption={t('saved.caption')}
            onRowClick={(id) => navigate(`/requests?sel=${encodeURIComponent(id)}`)}
            renderActions={(row) => (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  aria-label={t('request:table.rowActions', { id: row.id })}
                  className="flex size-8 items-center justify-center rounded-md text-secondary hover:bg-subtle"
                >
                  <icons.more aria-hidden size={20} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="z-50 min-w-48 rounded-lg border border-default bg-surface p-1 shadow-overlay"
                  >
                    <DropdownMenu.Item
                      onSelect={() => navigate(`/requests?sel=${encodeURIComponent(row.id)}`)}
                      className="type-body-m flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-primary outline-none data-highlighted:bg-subtle"
                    >
                      <icons.eye aria-hidden size={16} />
                      {t('saved.viewDetails')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => remove(row.id)}
                      className="type-body-m flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-primary outline-none data-highlighted:bg-subtle"
                    >
                      <icons.trash aria-hidden size={16} />
                      {t('saved.remove')}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          />
          {lastPage > 1 ? (
            <Pagination meta={{ current_page: page, last_page: lastPage, per_page: PER_PAGE, total: rows.length }} onPageChange={setPage} />
          ) : (
            <p className="type-body-s text-secondary">{t('saved.summary', { from: 1, to: rows.length, total: rows.length })}</p>
          )}
        </>
      )}

      </div>
      <p className="type-body-s flex items-center gap-2 text-tertiary">
        <icons.info aria-hidden size={16} className="shrink-0" />
        {t('saved.note')}
      </p>
    </div>
  )
}

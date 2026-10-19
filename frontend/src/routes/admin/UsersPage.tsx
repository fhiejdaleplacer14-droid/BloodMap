import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Pagination } from '../../components/ui/Pagination'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { downloadCsv, useAdminUsers, type AccountStatus, type UserFilters } from '../../lib/api/admin'
import { useMe, type Role } from '../../lib/api/auth'
import { useMunicipalities } from '../../lib/api/requests'
import { cn } from '../../lib/cn'
import { useDebouncedCallback } from '../../lib/hooks'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { agoLabel } from '../coord/coordText'
import { StatusTag, UserDrawer } from './UserDialogs'

const ShieldCheck = icons['shield-check']

const ROLES: Role[] = ['donor', 'facility_submitter', 'coordinator', 'admin']
const STATUSES: AccountStatus[] = ['active', 'unverified', 'restricted']

/** Admin / User Management (39:441). Row → account details drawer (39:833). */
export function UsersPage() {
  const { t } = useTranslation(['admin', 'coord', 'states'])
  const { t: tCoord } = useTranslation('coord')
  useDocumentTitle(t('users.title'))
  const me = useMe().data
  const [params, setParams] = useSearchParams()
  const role = params.get('role')
  const status = params.get('status')
  const filters: UserFilters = {
    q: params.get('q') ?? undefined,
    role: ROLES.includes(role as Role) ? (role as Role) : undefined,
    status: STATUSES.includes(status as AccountStatus) ? (status as AccountStatus) : undefined,
    area_id: params.get('area') ?? undefined,
    page: Math.max(1, Number(params.get('page')) || 1),
  }
  const users = useAdminUsers(filters)
  const municipalities = useMunicipalities().data ?? []
  const areas = [...new Map(municipalities.map((m) => [m.area.id, m.area])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const [search, setSearch] = useState(filters.q ?? '')
  const [openId, setOpenId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [now] = useState(() => new Date())

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

  const exportList = async () => {
    setExporting(true)
    try {
      await downloadCsv('/api/admin/users/export', { q: filters.q, role: filters.role, status: filters.status, area_id: filters.area_id }, 'bloodmap-users.csv')
    } catch {
      toast({ tone: 'error', title: t('users.exportFailed') })
    } finally {
      setExporting(false)
    }
  }

  const rows = users.data?.data ?? []
  const meta = users.data?.meta
  const head = 'type-overline h-10 px-3 text-left font-semibold whitespace-nowrap text-secondary'
  const cell = 'px-3 py-2.5 align-middle'

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        actions={
          <Button variant="secondary" icon="file-text" loading={exporting} onClick={() => void exportList()}>
            {t('users.export')}
          </Button>
        }
      />

      <div role="search" className="flex flex-wrap items-end gap-3">
        <div className="w-72 max-sm:w-full">
          <TextField
            type="search"
            label={t('users.search')}
            placeholder={t('users.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              pushSearch(e.target.value)
            }}
            onClear={() => {
              setSearch('')
              update({ q: undefined })
            }}
          />
        </div>
        <div className="w-48 max-sm:w-full">
          <SelectField label={t('users.role')} value={filters.role ?? ''} onChange={(e) => update({ role: e.target.value || undefined })}>
            <option value="">{t('users.allRoles')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-44 max-sm:w-full">
          <SelectField label={t('users.status')} value={filters.status ?? ''} onChange={(e) => update({ status: e.target.value || undefined })}>
            <option value="">{t('users.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-48 max-sm:w-full">
          <SelectField label={t('users.area')} value={filters.area_id ?? ''} onChange={(e) => update({ area: e.target.value || undefined })}>
            <option value="">{t('users.allAreas')}</option>
            {areas.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {users.isPending ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : users.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void users.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="users" title={t('coord:queue.emptyTitle')} description={t('users.empty')} actions={null} />
      ) : (
        <>
          <div className={cn('overflow-x-auto rounded-lg border border-default', users.isPlaceholderData && 'opacity-60')}>
            <table className="w-full min-w-220 border-collapse">
              <caption className="sr-only">{t('users.caption')}</caption>
              <thead className="bg-subtle">
                <tr>
                  {(['user', 'role', 'status', 'area', 'lastActive'] as const).map((key) => (
                    <th key={key} scope="col" className={head}>
                      {t(`users.columns.${key}`)}
                    </th>
                  ))}
                  <th scope="col" className={head}>
                    <span className="sr-only">{t('users.columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} onClick={() => setOpenId(u.id)} className={cn('cursor-pointer border-t border-default hover:bg-canvas', openId === u.id ? 'bg-brand-soft' : 'bg-surface')}>
                    <th scope="row" className={cn(cell, 'text-left font-normal')}>
                      <span className="flex items-center gap-3">
                        <Avatar initials={u.initials} size="md" />
                        <span className="flex min-w-0 flex-col">
                          <span className="type-label-m truncate text-primary">{u.name}</span>
                          <span className="type-body-s truncate text-secondary">{u.email}</span>
                        </span>
                      </span>
                    </th>
                    <td className={cn(cell, 'type-body-m whitespace-nowrap text-primary')}>
                      <span className="inline-flex items-center gap-1.5">
                        {u.role === 'donor' ? <icons.user aria-hidden size={14} /> : <ShieldCheck aria-hidden size={14} />}
                        {t(`roles.${u.role}`)}
                      </span>
                      {u.pending_role_change && <span className="type-body-s block text-status-warning">{t('users.pendingAdmin')}</span>}
                    </td>
                    <td className={cell}>
                      <StatusTag status={u.status} />
                    </td>
                    <td className={cn(cell, 'type-body-m text-primary')}>{u.area?.short_name ?? u.coordination_point?.name ?? '—'}</td>
                    <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                      {u.last_active_at ? agoLabel(u.last_active_at, tCoord, now) : t('users.never')}
                    </td>
                    <td className={cn(cell, 'text-right')}>
                      <button
                        type="button"
                        aria-label={t('users.open', { name: u.name })}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenId(u.id)
                        }}
                        className="inline-flex size-8 items-center justify-center rounded-md text-secondary hover:bg-subtle"
                      >
                        <icons.more aria-hidden size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="type-body-s text-secondary">
                {t('users.summary', { from: (meta.current_page - 1) * meta.per_page + 1, to: (meta.current_page - 1) * meta.per_page + rows.length, total: meta.total })}
              </p>
              {meta.last_page > 1 && <Pagination meta={meta} onPageChange={(page) => update({ page: String(page) })} />}
            </div>
          )}
        </>
      )}

      {me && <UserDrawer userId={openId} me={me} onClose={() => setOpenId(null)} />}
    </div>
  )
}

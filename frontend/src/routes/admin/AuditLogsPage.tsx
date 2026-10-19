import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { DateField } from '../../components/ui/DateTimeField'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Pagination } from '../../components/ui/Pagination'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/toast'
import { downloadCsv, useAuditLogs, type AuditFilters, type AuditRow } from '../../lib/api/admin'
import { cn } from '../../lib/cn'
import { isIsoDate, manilaToday, shiftDate } from '../../lib/dates'
import { DISPLAY_TIME_ZONE } from '../../lib/datetime'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const ACTION_GROUPS = ['request', 'user', 'account', 'admin'] as const

function timestamp(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** Sanitized context (41:1616): transitions, reasons and a few safe meta fields. Never IPs or payloads. */
function context(row: AuditRow): string {
  const parts: string[] = []
  if (row.from || row.to) parts.push(`${row.from ?? '—'} → ${row.to ?? '—'}`)
  if (row.reason) parts.push(`reason: ${row.reason}`)
  if (row.meta.fields?.length) parts.push(`fields: ${row.meta.fields.join(', ')}`)
  if (row.meta.device) parts.push(row.meta.device)
  if (row.meta.paused_requests) parts.push(`paused requests: ${row.meta.paused_requests}`)
  if (row.meta.count !== undefined) parts.push(`rows: ${row.meta.count}`)
  return parts.join(' · ')
}

/** Admin / Audit Logs (41:1616). Append-only; the API has no update or delete routes. */
export function AuditLogsPage() {
  const { t } = useTranslation(['admin', 'coord', 'states'])
  useDocumentTitle(t('audit.title'))
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => manilaToday())
  const read = (key: string) => params.get(key) ?? undefined
  const from = read('from')
  const to = read('to')
  const filters: AuditFilters = {
    from: from && isIsoDate(from) ? from : shiftDate(today, -7),
    to: to && isIsoDate(to) ? to : today,
    actor: read('actor'),
    action: read('action'),
    resource: read('resource'),
    page: Math.max(1, Number(params.get('page')) || 1),
  }
  const log = useAuditLogs(filters)
  const [exporting, setExporting] = useState(false)

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadCsv(
        '/api/admin/audit-logs',
        { from: filters.from, to: filters.to, actor: filters.actor, action: filters.action, resource: filters.resource, format: 'csv' },
        'bloodmap-audit-log.csv',
      )
    } catch {
      toast({ tone: 'error', title: t('audit.exportFailed') })
    } finally {
      setExporting(false)
    }
  }

  const meta = log.data?.meta
  const rows = log.data?.data ?? []
  const head = 'type-overline h-10 px-3 text-left font-semibold whitespace-nowrap text-secondary'
  const cell = 'px-3 py-2.5 align-top'

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        actions={
          <Button variant="secondary" icon="file-text" loading={exporting} onClick={() => void exportCsv()}>
            {t('audit.export')}
          </Button>
        }
      />

      <div role="search" className="flex flex-wrap items-end gap-3">
        <div className="w-40 max-sm:w-full">
          <DateField label={t('audit.from')} value={filters.from} max={filters.to} onChange={(e) => update({ from: e.target.value || undefined })} />
        </div>
        <div className="w-40 max-sm:w-full">
          <DateField label={t('audit.to')} value={filters.to} min={filters.from} max={today} onChange={(e) => update({ to: e.target.value || undefined })} />
        </div>
        <div className="w-48 max-sm:w-full">
          <SelectField label={t('audit.actor')} value={filters.actor ?? ''} onChange={(e) => update({ actor: e.target.value || undefined })}>
            <option value="">{t('audit.anyone')}</option>
            <option value="system">{t('audit.system')}</option>
            {meta?.actors.map((actor) => (
              <option key={actor.id} value={String(actor.id)}>
                {actor.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-56 max-sm:w-full">
          <SelectField label={t('audit.action')} value={filters.action ?? ''} onChange={(e) => update({ action: e.target.value || undefined })}>
            <option value="">{t('audit.allActions')}</option>
            {ACTION_GROUPS.map((group) => (
              <option key={group} value={`${group}.`}>
                {t(`audit.actionGroups.${group}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-44 max-sm:w-full">
          <SelectField label={t('audit.resource')} value={filters.resource ?? ''} onChange={(e) => update({ resource: e.target.value || undefined })}>
            <option value="">{t('audit.allResources')}</option>
            {(['request', 'user'] as const).map((r) => (
              <option key={r} value={r}>
                {t(`audit.resources.${r}`)}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <p className="type-body-s -mt-2 flex items-center gap-2 text-secondary">
        <icons.lock aria-hidden size={14} className="shrink-0" />
        {t('audit.note')}
      </p>

      {log.isPending ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : log.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void log.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="history" title={t('coord:queue.emptyTitle')} description={t('audit.empty')} actions={null} />
      ) : (
        <>
          <div className={cn('overflow-x-auto rounded-lg border border-default', log.isPlaceholderData && 'opacity-60')}>
            <table className="w-full min-w-250 border-collapse">
              <caption className="sr-only">{t('audit.caption')}</caption>
              <thead className="bg-subtle">
                <tr>
                  {(['timestamp', 'actor', 'action', 'resource', 'result', 'context'] as const).map((key) => (
                    <th key={key} scope="col" className={head}>
                      {t(`audit.columns.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-default bg-surface">
                    <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                      <time dateTime={row.created_at}>{timestamp(row.created_at)}</time>
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap')}>
                      <span className="type-body-m inline-flex items-center gap-2 text-primary">
                        <Avatar initials={row.initials ?? 'SY'} />
                        {row.actor?.name ?? t('audit.system')}
                      </span>
                    </td>
                    <td className={cn(cell, 'type-mono-s whitespace-nowrap text-primary')}>{row.action}</td>
                    <td className={cn(cell, 'type-mono-s whitespace-nowrap text-primary')}>{row.resource}</td>
                    <td className={cell}>
                      <span className="type-label-s inline-flex items-center gap-1 rounded-sm bg-status-success px-1.5 py-0.5 text-status-success">
                        <icons.check aria-hidden size={12} />
                        {t('audit.success')}
                      </span>
                    </td>
                    <td className={cn(cell, 'type-body-s max-w-80 break-words text-secondary')}>{context(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="type-body-s text-secondary">
                {t('audit.summary', { from: (meta.current_page - 1) * meta.per_page + 1, to: (meta.current_page - 1) * meta.per_page + rows.length, total: meta.total })}
              </p>
              {meta.last_page > 1 && <Pagination meta={meta} onPageChange={(page) => update({ page: String(page) })} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

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
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { downloadActivity, useCoordinatorActivity, type ActivityFilters } from '../../lib/api/coordinator'
import { cn } from '../../lib/cn'
import { isIsoDate, manilaToday, shiftDate } from '../../lib/dates'
import { DISPLAY_TIME_ZONE } from '../../lib/datetime'
import { useDebouncedCallback } from '../../lib/hooks'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { actionLabel, activityContext } from './coordText'

const CheckIcon = icons.check

/** "2026-10-15 14:20:31" in Manila (36:1105). */
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

/** Coordinator / Activity Log (36:1105). Read-only; defaults to the last 7 days. */
export function CoordActivityPage() {
  const { t, i18n } = useTranslation(['coord', 'manage', 'states'])
  useDocumentTitle(t('activity.title'))
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => manilaToday())
  const read = (key: string) => params.get(key) ?? undefined
  const from = read('from')
  const to = read('to')
  const filters: ActivityFilters = {
    from: from && isIsoDate(from) ? from : shiftDate(today, -7),
    to: to && isIsoDate(to) ? to : today,
    actor: read('actor'),
    action: read('action'),
    target: read('target'),
    page: Math.max(1, Number(params.get('page')) || 1),
  }
  const log = useCoordinatorActivity(filters)
  const [target, setTarget] = useState(filters.target ?? '')
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
  const pushTarget = useDebouncedCallback((value: string) => update({ target: value.trim() || undefined }), 300)

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadActivity({ from: filters.from, to: filters.to, actor: filters.actor, action: filters.action, target: filters.target })
    } catch {
      toast({ tone: 'error', title: t('activity.exportFailed') })
    } finally {
      setExporting(false)
    }
  }

  const meta = log.data?.meta
  const rows = log.data?.data ?? []
  const head = 'type-overline h-10 px-3 text-left font-semibold whitespace-nowrap text-secondary'
  const cell = 'px-3 py-3 align-top'

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
        actions={
          <Button variant="secondary" icon="file-text" loading={exporting} onClick={() => void exportCsv()}>
            {t('activity.export')}
          </Button>
        }
      />

      <div role="search" className="flex flex-wrap items-end gap-3">
        <div className="w-40 max-sm:w-full">
          <DateField label={t('activity.from')} value={filters.from} max={filters.to} onChange={(e) => update({ from: e.target.value || undefined })} />
        </div>
        <div className="w-40 max-sm:w-full">
          <DateField label={t('activity.to')} value={filters.to} min={filters.from} max={today} onChange={(e) => update({ to: e.target.value || undefined })} />
        </div>
        <div className="w-50 max-sm:w-full">
          <SelectField label={t('activity.actor')} value={filters.actor ?? ''} onChange={(e) => update({ actor: e.target.value || undefined })}>
            <option value="">{t('activity.anyone')}</option>
            <option value="system">{t('activity.system')}</option>
            {meta?.actors.map((actor) => (
              <option key={actor.id} value={String(actor.id)}>
                {actor.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-56 max-sm:w-full">
          <SelectField label={t('activity.action')} value={filters.action ?? ''} onChange={(e) => update({ action: e.target.value || undefined })}>
            <option value="">{t('activity.allActions')}</option>
            {meta?.actions.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action, t)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-52 max-sm:w-full">
          <TextField
            type="search"
            label={t('activity.target')}
            placeholder={t('activity.targetPlaceholder')}
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              pushTarget(e.target.value)
            }}
            onClear={() => {
              setTarget('')
              update({ target: undefined })
            }}
          />
        </div>
      </div>

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
        <EmptyState icon="history" title={t('queue.emptyTitle')} description={t('activity.empty')} actions={null} />
      ) : (
        <>
          <div className={cn('overflow-x-auto rounded-lg border border-default', log.isPlaceholderData && 'opacity-60')}>
            <table className="w-full min-w-240 border-collapse">
              <caption className="sr-only">{t('activity.caption')}</caption>
              <thead className="sticky top-0 bg-subtle">
                <tr>
                  {(['timestamp', 'actor', 'action', 'target', 'outcome', 'context'] as const).map((key) => (
                    <th key={key} scope="col" className={head}>
                      {t(`activity.columns.${key}`)}
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
                        <Avatar initials={row.actor?.initials ?? 'SY'} />
                        {row.actor?.name ?? t('activity.system')}
                      </span>
                    </td>
                    <td className={cn(cell, 'type-body-m text-primary')}>{actionLabel(row.action, t)}</td>
                    <td className={cn(cell, 'type-mono-s whitespace-nowrap text-primary')}>{row.target ?? '—'}</td>
                    <td className={cell}>
                      <span className="type-label-s inline-flex items-center gap-1 rounded-sm bg-status-success px-1.5 py-0.5 text-status-success">
                        <CheckIcon aria-hidden size={12} />
                        {t('activity.success')}
                      </span>
                    </td>
                    <td className={cn(cell, 'type-body-s max-w-64 text-secondary')}>{activityContext(row, t, i18n.language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="type-body-s text-secondary">
                {t('activity.summary', {
                  from: (meta.current_page - 1) * meta.per_page + 1,
                  to: (meta.current_page - 1) * meta.per_page + rows.length,
                  total: meta.total,
                })}
              </p>
              {meta.last_page > 1 && <Pagination meta={meta} onPageChange={(page) => update({ page: String(page) })} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

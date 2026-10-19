import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { PageHeader, Panel } from '../../components/layout/WorkspaceLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons, type IconName } from '../../components/ui/icons'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAdminSummary, type AdminSummary } from '../../lib/api/admin'
import { cn } from '../../lib/cn'
import { formatCalendarDate, formatShortDate } from '../../lib/datetime'
import { REQUEST_STATUSES } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]

function waitLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  return h < 24 ? `${h} h ${String(minutes % 60).padStart(2, '0')} min` : `${Math.floor(h / 24)} d ${h % 24} h`
}

/** Admin / Overview (38:2). Real counts from GET /api/admin/summary. */
export function AdminOverviewPage() {
  const { t, i18n } = useTranslation(['admin', 'states'])
  useDocumentTitle(t('overview.title'))
  const [days, setDays] = useState<Period>(30)
  const summary = useAdminSummary(days)
  const s = summary.data
  const locale = i18n.language

  if (summary.isError) {
    return (
      <div className="p-8 max-sm:p-4">
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void summary.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      </div>
    )
  }

  const expiredNote = s
    ? s.expired.total > s.expired.previous
      ? t('overview.expiredUp', { count: s.expired.previous })
      : s.expired.total < s.expired.previous
        ? t('overview.expiredDown', { count: s.expired.previous })
        : t('overview.expiredSame')
    : ''

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('overview.title')}
        subtitle={
          s ? t('overview.subtitle', { days: s.days, from: formatShortDate(`${s.from}T12:00:00Z`, locale), to: formatCalendarDate(s.to, locale) }) : undefined
        }
        actions={
          <SegmentedControl
            label={t('overview.period')}
            value={String(days)}
            onValueChange={(value) => setDays(Number(value) as Period)}
            segments={PERIODS.map((p) => ({ value: String(p), label: t('overview.days', { count: p }), icon: 'calendar' as const }))}
          />
        }
      />

      <div aria-busy={!s || undefined} className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', summary.isPlaceholderData && 'opacity-60')}>
        <Stat icon="users" label={t('overview.accounts')} value={s?.accounts.total} note={s && t('overview.accountsNote', { count: s.accounts.new })} />
        <Stat icon="list" label={t('overview.active')} value={s?.active.total} note={s && t('overview.activeNote', { count: s.active.municipalities })} />
        <Stat
          icon="clipboard-check"
          label={t('overview.pending')}
          value={s?.pending.total}
          note={s && (s.pending.median_wait_minutes === null ? t('overview.noneWaiting') : t('overview.medianWait', { time: waitLabel(s.pending.median_wait_minutes) }))}
        />
        <Stat icon="hourglass" label={t('overview.expired')} value={s?.expired.total} note={expiredNote} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel title={t('overview.overTime')} subtitle={t('overview.overTimeNote')} action={{ label: t('overview.requestsLink'), to: '/coord/active' }}>
          {s ? <LineChart summary={s} /> : <Skeleton className="m-5 h-48" />}
        </Panel>
        <Panel title={t('overview.distribution')} subtitle={s ? t('overview.distributionNote', { count: total(s) }) : undefined} action={{ label: t('overview.requestsLink'), to: '/coord/active' }}>
          {s ? <Distribution summary={s} /> : <Skeleton className="m-5 h-48" />}
        </Panel>
        <Panel title={t('overview.byMunicipality')} subtitle={t('overview.byMunicipalityNote')} action={{ label: t('overview.coordinatorsLink'), to: '/admin/coordinators' }}>
          {s ? <ByMunicipality summary={s} /> : <Skeleton className="m-5 h-48" />}
        </Panel>
        <Panel title={t('overview.recent')} action={{ label: t('overview.auditLink'), to: '/admin/audit' }}>
          {!s ? (
            <Skeleton className="m-5 h-40" />
          ) : s.recent.length === 0 ? (
            <p className="type-body-m px-5 py-6 text-secondary">{t('overview.noRecent')}</p>
          ) : (
            <ul className="flex flex-col gap-4 px-5 py-4">
              {s.recent.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <Avatar initials={initialsOf(event.actor)} />
                  <div className="flex min-w-0 flex-col">
                    <span className="type-body-s text-primary">
                      {t(`overview.events.${event.action}` as 'overview.events.user.restricted', {
                        target: event.target ?? '—',
                        to: event.to ? t(`roles.${event.to}` as 'roles.donor', { defaultValue: event.to }) : '',
                      })}
                    </span>
                    <span className="type-mono-s text-tertiary">
                      {event.actor ?? t('overview.system')} · {formatShortDate(event.created_at, locale)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

const total = (s: AdminSummary) => Object.values(s.statuses).reduce((a, b) => a + (b ?? 0), 0)

function initialsOf(name: string | null): string {
  if (!name) return 'SY'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function Stat({ icon, label, value, note }: { icon: IconName; label: string; value: number | undefined; note: ReactNode }) {
  const Icon = icons[icon]
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-default bg-surface p-5">
      <h2 className="type-label-m flex items-center gap-2 text-secondary">
        <Icon aria-hidden size={16} />
        {label}
      </h2>
      {value === undefined ? <Skeleton className="h-9 w-20" /> : <p className="type-h1 text-primary">{value.toLocaleString()}</p>}
      <p className="type-body-s text-secondary">{note}</p>
    </section>
  )
}

/** Created vs. expired without update (38:2): two polylines over a fixed grid, with a text summary. */
function LineChart({ summary }: { summary: AdminSummary }) {
  const { t, i18n } = useTranslation('admin')
  const series = summary.series
  const peak = Math.max(0, ...series.flatMap((d) => [d.created, d.expired]))
  const max = Math.max(10, Math.ceil(peak / 5) * 5)
  const W = 600
  const H = 160
  const x = (i: number) => (series.length <= 1 ? 0 : (i / (series.length - 1)) * W)
  const y = (v: number) => H - (v / max) * H
  const line = (key: 'created' | 'expired') => series.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')
  const step = series.length <= 7 ? 1 : series.length <= 30 ? 7 : 14
  const sum = (key: 'created' | 'expired') => series.reduce((a, d) => a + d[key], 0)

  return (
    <div className="flex flex-col gap-3 p-5">
      <ul className="flex flex-wrap gap-4">
        <li className="type-body-s flex items-center gap-1.5 text-secondary">
          <span aria-hidden className="h-0.5 w-4 bg-inverse" />
          {t('overview.created')}
        </li>
        <li className="type-body-s flex items-center gap-1.5 text-secondary">
          <span aria-hidden className="h-0.5 w-4 bg-(--status-warning-fg)" />
          {t('overview.expiredSeries')}
        </li>
      </ul>
      <div className="relative ml-6 h-40">
        {[max, max / 2, 0].map((tick) => (
          <div key={tick} aria-hidden className="absolute inset-x-0 border-t border-default" style={{ bottom: `${(tick / max) * 100}%` }}>
            <span className="type-mono-s absolute -top-2 -left-6 w-5 text-right text-tertiary">{tick}</span>
          </div>
        ))}
        <svg role="img" aria-label={t('overview.overTimeLabel')} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <polyline points={line('created')} fill="none" className="stroke-(--text-primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <polyline points={line('expired')} fill="none" className="stroke-(--status-warning-fg)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div aria-hidden className="relative ml-6 h-4">
        {series.map((d, i) =>
          i % step === 0 ? (
            <span key={d.date} className="type-mono-s absolute -translate-x-1/2 text-tertiary" style={{ left: `${(x(i) / W) * 100}%` }}>
              {formatShortDate(`${d.date}T12:00:00Z`, i18n.language)}
            </span>
          ) : null,
        )}
      </div>
      <p className="sr-only">{t('overview.overTimeSummary', { created: sum('created'), expired: sum('expired') })}</p>
    </div>
  )
}

function Distribution({ summary }: { summary: AdminSummary }) {
  const { t } = useTranslation('admin')
  const n = total(summary)
  if (n === 0) return <p className="type-body-m px-5 py-6 text-secondary">{t('overview.noRequests')}</p>
  const rows = REQUEST_STATUSES.map((status) => ({ status, count: summary.statuses[status] ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
  return (
    <ul className="flex flex-col gap-3 px-5 py-4">
      {rows.map(({ status, count }) => {
        const pct = Math.round((count / n) * 100)
        return (
          <li key={status} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={status} />
              <span className="type-mono-s text-secondary">
                {count} · {pct}%
              </span>
            </div>
            <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
              <span className="block h-full rounded-full bg-(--text-secondary)" style={{ width: `${pct}%` }} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function ByMunicipality({ summary }: { summary: AdminSummary }) {
  const { t } = useTranslation('admin')
  const rows = summary.municipalities
  if (rows.length === 0) return <p className="type-body-m px-5 py-6 text-secondary">{t('overview.noRequests')}</p>
  const max = Math.max(...rows.map((r) => r.requests))
  return (
    <ul className="flex flex-col gap-3 px-5 py-4">
      {rows.map((row) => (
        <li key={row.id} className="grid grid-cols-[9rem_minmax(0,1fr)_9rem] items-center gap-3 max-sm:grid-cols-[7rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col">
            <span className="type-label-m truncate text-primary">{row.name}</span>
            <span className="type-body-s truncate text-tertiary">{row.province}</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2 rounded-xs bg-inverse" style={{ width: `${(row.requests / max) * 85}%` }} />
            <span className="type-mono-s text-secondary">{row.requests}</span>
          </div>
          <span className={cn('type-body-s inline-flex items-center gap-1.5 max-sm:col-span-2', row.coordinators ? 'text-secondary' : 'text-status-warning')}>
            <span aria-hidden className={cn('size-1.5 rounded-full', row.coordinators ? 'bg-(--status-success-fg)' : 'bg-(--status-warning-fg)')} />
            {row.coordinators ? t('overview.coordinators', { count: row.coordinators }) : t('overview.noCoordinator')}
          </span>
        </li>
      ))}
    </ul>
  )
}

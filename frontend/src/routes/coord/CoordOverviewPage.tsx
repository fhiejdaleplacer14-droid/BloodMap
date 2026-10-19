import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { PageHeader, Panel } from '../../components/layout/WorkspaceLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons, type IconName } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { useCoordinatorSummary, type DayActivity } from '../../lib/api/coordinator'
import { cn } from '../../lib/cn'
import { DISPLAY_TIME_ZONE } from '../../lib/datetime'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { actionLabel, agoLabel, durationLabel, reviewHref, untilLabel } from './coordText'

const ClipboardCheck = icons['clipboard-check']

/** A wait this long is called out in amber (35:12 shows 3 h 10 min in warning). */
const LONG_WAIT_MS = 3 * 3_600_000

/** Coordinator / Overview (35:12). Every number comes from GET /api/coordinator/summary. */
export function CoordOverviewPage() {
  const { t, i18n } = useTranslation(['coord', 'states'])
  useDocumentTitle(t('overview.title'))
  const summary = useCoordinatorSummary()
  const [now] = useState(() => new Date())
  const today = new Intl.DateTimeFormat(i18n.language, {
    timeZone: DISPLAY_TIME_ZONE,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(now)

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

  const s = summary.data
  const oldestLong = s?.oldest_pending_at ? now.getTime() - new Date(s.oldest_pending_at).getTime() >= LONG_WAIT_MS : false

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle', { area: s?.area?.name ?? t('overview.allAreas'), date: today })}
        actions={
          <Button asChild variant="primary">
            <Link to="/coord/queue">
              <ClipboardCheck aria-hidden size={16} />
              {t('overview.openQueue')}
            </Link>
          </Button>
        }
      />

      <div aria-busy={summary.isPending || undefined} className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon="clipboard-check"
          label={t('overview.stats.pending')}
          value={s?.pending_review}
          note={
            s?.oldest_pending_at ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn('size-1.5 rounded-full', oldestLong ? 'bg-(--status-warning-fg)' : 'bg-(--border-strong)')} />
                {t('overview.stats.oldest', { time: durationLabel(s.oldest_pending_at, t, now) })}
              </span>
            ) : (
              t('overview.stats.noneWaiting')
            )
          }
        />
        <StatCard icon="list" label={t('overview.stats.active')} value={s?.active} note={t('overview.stats.activeNote')} />
        <StatCard icon="hourglass" label={t('overview.stats.expiring')} value={s?.expiring_24h} note={t('overview.stats.expiringNote')} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel
          title={t('overview.needsReview')}
          titleNote={t('overview.oldestFirst')}
          action={{ label: t('overview.openQueueLink'), to: '/coord/queue' }}
        >
          {!s ? (
            <PanelSkeleton />
          ) : s.needs_review.length === 0 ? (
            <p className="type-body-m px-5 py-6 text-secondary">{t('overview.noReviews')}</p>
          ) : (
            <ul>
              {s.needs_review.map((r) => {
                const since = r.first_submitted_at ?? r.submitted_at ?? r.created_at
                const long = now.getTime() - new Date(since).getTime() >= LONG_WAIT_MS
                return (
                  <li key={r.id} className="flex items-center gap-3 border-b border-default px-5 py-3 last:border-b-0">
                    <BloodTypeTag type={r.blood_type} size="sm" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="type-mono-s text-primary">{r.id}</span>
                      <span className="type-body-s truncate text-secondary">{r.location.municipality}</span>
                    </div>
                    <span className={cn('type-mono-s inline-flex items-center gap-1', long ? 'text-status-warning' : 'text-secondary')}>
                      <icons.clock aria-hidden size={14} />
                      {durationLabel(since, t, now)}
                    </span>
                    <span className="w-22 shrink-0 text-right max-sm:hidden">
                      {r.assigned_coordinator ? (
                        <>
                          <Avatar initials={r.assigned_coordinator.initials} />
                          <span className="sr-only">{r.assigned_coordinator.name}</span>
                        </>
                      ) : (
                        <span className="type-body-s text-tertiary">{t('overview.unassigned')}</span>
                      )}
                    </span>
                    <Button asChild variant="secondary">
                      <Link to={reviewHref(r.id)} aria-label={t('overview.reviewRequest', { id: r.id })}>
                        {t('overview.review')}
                      </Link>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t('overview.expiringSoon')} titleNote={t('overview.next24h')} action={{ label: t('overview.activeLink'), to: '/coord/active' }}>
          {!s ? (
            <PanelSkeleton />
          ) : s.expiring_soon.length === 0 ? (
            <p className="type-body-m px-5 py-6 text-secondary">{t('overview.noExpiring')}</p>
          ) : (
            <ul className="flex flex-col gap-1 py-2">
              {s.expiring_soon.map((r) => (
                <li key={r.id}>
                  <Link to={reviewHref(r.id)} className="flex items-center gap-3 px-5 py-2.5 hover:bg-canvas">
                    <BloodTypeTag type={r.blood_type} size="sm" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="type-mono-s text-secondary">{r.id}</span>
                      <span className="type-label-m truncate text-primary">{r.location.municipality}</span>
                    </div>
                    {r.expires_at && (
                      <span className="type-mono-s inline-flex items-center gap-1 text-status-warning">
                        <icons.hourglass aria-hidden size={14} />
                        {t('overview.in', { time: untilLabel(r.expires_at, t, now) })}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('overview.activityTitle')} titleNote={t('overview.last7')} action={{ label: t('overview.activityLink'), to: '/coord/activity' }}>
          {!s ? <PanelSkeleton /> : <ActivityChart days={s.activity} />}
        </Panel>

        <Panel title={t('overview.recent')} action={{ label: t('overview.activeLink'), to: '/coord/active' }}>
          {!s ? (
            <PanelSkeleton />
          ) : s.recently_updated.length === 0 ? (
            <p className="type-body-m px-5 py-6 text-secondary">{t('overview.noRecent')}</p>
          ) : (
            <ul>
              {s.recently_updated.map((u) => (
                <li key={u.id} className="flex items-start justify-between gap-3 border-b border-default px-5 py-3 last:border-b-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {u.request_id ? (
                      <Link to={reviewHref(u.request_id)} className="type-mono-s rounded-sm text-primary hover:underline">
                        {u.request_id}
                      </Link>
                    ) : null}
                    <span className="type-body-s text-secondary">
                      {actionLabel(u.action, t)} · {t(`overview.by.${u.by}`)}
                    </span>
                  </div>
                  <time dateTime={u.created_at} className="type-mono-s shrink-0 text-tertiary">
                    {agoLabel(u.created_at, t, now)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, note }: { icon: IconName; label: string; value: number | undefined; note: ReactNode }) {
  const Icon = icons[icon]
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-default bg-surface p-5">
      <h2 className="type-label-m flex items-center gap-2 text-secondary">
        <Icon aria-hidden size={16} />
        {label}
      </h2>
      {value === undefined ? <Skeleton className="h-10 w-16" /> : <p className="type-display-48 text-primary">{value}</p>}
      <p className="type-body-s text-secondary">{note}</p>
    </section>
  )
}

function PanelSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3 p-5">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

const SERIES = [
  { key: 'approved', className: 'bg-inverse' },
  { key: 'correction_requested', className: 'bg-(--status-warning-fg)' },
  { key: 'rejected', className: 'bg-(--border-strong)' },
] as const

/** Review activity (35:12): grouped bars per day. Plain markup, with a text alternative. */
function ActivityChart({ days }: { days: DayActivity[] }) {
  const { t, i18n } = useTranslation('coord')
  const peak = Math.max(0, ...days.flatMap((d) => [d.approved, d.correction_requested, d.rejected]))
  const max = Math.max(10, Math.ceil(peak / 5) * 5)
  const weekday = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${date}T00:00:00Z`))

  return (
    <div className="flex flex-col gap-4 p-5">
      <ul className="flex flex-wrap gap-4">
        {SERIES.map((series) => (
          <li key={series.key} className="type-body-s flex items-center gap-1.5 text-secondary">
            <span aria-hidden className={cn('size-2.5 rounded-xs', series.className)} />
            {t(`overview.legend.${series.key}`)}
          </li>
        ))}
      </ul>
      <div role="img" aria-label={t('overview.chartLabel')} className="relative ml-6 h-40">
        {[max, max / 2, 0].map((tick) => (
          <div
            key={tick}
            aria-hidden
            className="absolute inset-x-0 border-t border-default"
            style={{ bottom: `${(tick / max) * 100}%` }}
          >
            <span className="type-mono-s absolute -top-2 -left-6 w-5 text-right text-tertiary">{tick}</span>
          </div>
        ))}
        <div aria-hidden className="absolute inset-0 flex items-end justify-around">
          {days.map((day) => (
            <div key={day.date} className="flex h-full items-end gap-1">
              {SERIES.map((series) => (
                <span
                  key={series.key}
                  className={cn('w-2.5 rounded-t-xs', series.className)}
                  style={{ height: `${(day[series.key] / max) * 100}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="ml-6 flex justify-around">
        {days.map((day) => (
          <span key={day.date} className="type-mono-s text-tertiary">
            {weekday(day.date)}
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {days.map((day) => (
          <li key={day.date}>
            {t('overview.dayTotal', {
              day: weekday(day.date),
              approved: day.approved,
              correction: day.correction_requested,
              rejected: day.rejected,
            })}
          </li>
        ))}
      </ul>
    </div>
  )
}

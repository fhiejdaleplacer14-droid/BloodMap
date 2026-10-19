import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { RequestCard } from '../../components/domain/RequestCard'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { PageHeader, Panel } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { icons, type IconName } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { useMe } from '../../lib/api/auth'
import { useActivity, useNotifications, useSavedRequests } from '../../lib/api/me'
import { getRequest, requestKeys } from '../../lib/api/requests'
import { manilaToday } from '../../lib/dates'
import { formatShortDateTime } from '../../lib/datetime'
import { useRecentlyViewed } from '../../lib/devicePrefs'
import { RECEDED_STATUSES, type PublicRequest } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { activityDetail, activityLabel } from './activityText'
import { UpdateRow } from './UpdateRow'

function greetingKey(now = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23' }).format(now))
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}

const isToday = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso)) === manilaToday()

function SavedSummary({ saved }: { saved: PublicRequest[] }) {
  const { t } = useTranslation('workspace')
  const active = saved.filter((r) => r.status === 'active')
  const counts = [
    { key: 'active', value: active.length },
    { key: 'expiringToday', value: active.filter((r) => r.expires_at && isToday(r.expires_at)).length },
    { key: 'inactive', value: saved.length - active.length },
  ] as const

  return (
    <>
      <div className="flex gap-3 px-5 py-4">
        {counts.map(({ key, value }) => (
          <div key={key} className="flex flex-1 flex-col gap-0.5 rounded-md bg-canvas p-3">
            <span className="type-h2 text-primary">{value}</span>
            <span className="type-body-s text-secondary">{t(`dashboard.counts.${key}`)}</span>
          </div>
        ))}
      </div>
      <ul>
        {saved.slice(0, 3).map((r) => {
          const receded = RECEDED_STATUSES.has(r.status)
          return (
            <li key={r.id}>
              <Link to={`/requests?sel=${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-canvas">
                <BloodTypeTag type={r.blood_type} size="sm" dimmed={receded} />
                <span className={`flex min-w-0 flex-1 flex-col ${receded ? 'text-secondary' : ''}`}>
                  <span className="type-mono-s text-secondary">{r.id}</span>
                  <span className={`type-label-m truncate ${receded ? 'text-secondary' : 'text-primary'}`}>{r.location.municipality}</span>
                </span>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function RecentlyViewed() {
  const { t } = useTranslation('workspace')
  const ids = useRecentlyViewed().slice(0, 2)
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: requestKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getRequest(id, signal),
      staleTime: 30_000,
      retry: false,
    })),
  })
  const requests = results.flatMap((r) => (r.data ? [r.data] : []))

  if (ids.length === 0) return <p className="type-body-s px-5 py-6 text-secondary">{t('dashboard.noRecent')}</p>
  return (
    <div className="grid grid-cols-2 gap-4 p-5 max-md:grid-cols-1">
      {results.some((r) => r.isPending) && requests.length === 0 ? (
        <Skeleton className="h-56 w-full rounded-lg" />
      ) : (
        requests.map((r) => <RequestCard key={r.id} request={r} to={`/requests?sel=${encodeURIComponent(r.id)}`} />)
      )}
    </div>
  )
}

/** Donor / Dashboard (28:19). */
export function DashboardPage() {
  const { t, i18n } = useTranslation('workspace')
  useDocumentTitle(t('crumbs.overview'))
  const { data: me } = useMe()
  const notifications = useNotifications()
  const saved = useSavedRequests()
  const activity = useActivity({})
  const firstName = me?.name.split(' ')[0] ?? ''

  const tips: Array<{ icon: IconName; key: 'id' | 'hours' | 'screening' | 'place' }> = [
    { icon: 'file-text', key: 'id' },
    { icon: 'clock', key: 'hours' },
    { icon: 'shield-check', key: 'screening' },
    { icon: 'building', key: 'place' },
  ]

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t(`dashboard.greeting.${greetingKey()}`, { name: firstName })}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/app/saved">
                <icons.bookmark aria-hidden size={16} />
                {t('dashboard.savedButton')}
              </Link>
            </Button>
            <Button asChild variant="primary">
              <Link to="/requests">
                <icons.search aria-hidden size={16} />
                {t('dashboard.explore')}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex gap-6 max-xl:flex-col">
        <Panel title={t('dashboard.updates')} action={{ label: t('dashboard.allNotifications'), to: '/app/notifications' }} className="flex-1">
          {notifications.isPending ? (
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : notifications.data?.data.length ? (
            <ul>
              {notifications.data.data.slice(0, 4).map((n) => (
                <UpdateRow key={n.id} notification={n} />
              ))}
            </ul>
          ) : (
            <p className="type-body-s px-5 py-6 text-secondary">{t('dashboard.noUpdates')}</p>
          )}
        </Panel>
        <Panel title={t('dashboard.savedPanel')} action={{ label: t('dashboard.viewAll'), to: '/app/saved' }} className="w-95 shrink-0 max-xl:w-full">
          {saved.data ? <SavedSummary saved={saved.data} /> : <Skeleton className="m-5 h-24" />}
        </Panel>
      </div>

      <div className="flex gap-6 max-xl:flex-col">
        <Panel title={t('dashboard.recent')} action={{ label: t('dashboard.openExplorer'), to: '/requests' }} className="flex-1">
          <RecentlyViewed />
        </Panel>
        <section className="flex w-95 shrink-0 flex-col gap-4 rounded-lg border border-default bg-surface p-5 max-xl:w-full">
          <h2 className="type-h4 text-primary">{t('dashboard.guidance.title')}</h2>
          <ul className="flex flex-col gap-4">
            {tips.map(({ icon, key }) => {
              const Icon = icons[icon]
              return (
                <li key={key} className="type-body-s flex gap-3 text-primary">
                  <Icon aria-hidden size={18} className="shrink-0 text-secondary" />
                  {t(`dashboard.guidance.${key}`)}
                </li>
              )
            })}
          </ul>
          <Button asChild variant="secondary" className="w-full">
            <Link to="/#safety">{t('dashboard.guidance.safety')}</Link>
          </Button>
        </section>
      </div>

      <Panel title={t('dashboard.account')} action={{ label: t('dashboard.myActivity'), to: '/app/activity' }}>
        {activity.data?.data.length ? (
          <ul>
            {activity.data.data.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center gap-6 border-b border-default px-5 py-3 last:border-b-0 max-sm:flex-wrap max-sm:gap-1">
                <span className="type-mono-s w-35 shrink-0 text-tertiary">{formatShortDateTime(item.created_at, i18n.language)}</span>
                <span className="type-body-m flex-1 text-primary">{activityLabel(item, t)}</span>
                <span className={item.request ? 'type-mono-s text-secondary' : 'type-body-s text-secondary'}>
                  {item.request ?? activityDetail(item, t, me?.preferences.email_saved_status_changes ?? false) ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body-s px-5 py-6 text-secondary">{activity.isPending ? '' : t('dashboard.noActivity')}</p>
        )}
      </Panel>
    </div>
  )
}

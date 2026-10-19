import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAdminSettings, type HealthStatus } from '../../lib/api/admin'
import { cn } from '../../lib/cn'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

function Card({ title, body, children, className }: { title: string; body?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-default bg-surface', className)}>
      <div className="border-b border-default px-5 py-4">
        <h2 className="type-h4 text-primary">{title}</h2>
        {body && <p className="type-body-s mt-0.5 text-secondary">{body}</p>}
      </div>
      {children}
    </section>
  )
}

function Facts({ rows }: { rows: [string, ReactNode, string?][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
      {rows.map(([label, value, help]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="type-label-m text-primary">{label}</dt>
          <dd className="type-body-m rounded-md border border-default bg-canvas px-3 py-2 text-primary">{value}</dd>
          {help && <dd className="type-body-s text-secondary">{help}</dd>}
        </div>
      ))}
    </dl>
  )
}

const HEALTH_TONE: Record<HealthStatus, string> = {
  operational: 'bg-status-success text-status-success',
  degraded: 'bg-status-warning text-status-warning',
  down: 'bg-status-critical text-status-critical',
}

/**
 * Admin / System Settings (41:2021) as a read-out: the values the platform
 * runs with today and live health. Editing waits for a settings store
 * (decision #72); secrets are never shown.
 */
export function SettingsPage() {
  const { t } = useTranslation(['admin', 'states'])
  useDocumentTitle(t('settings.title'))
  const settings = useAdminSettings()
  const s = settings.data

  if (settings.isError) {
    return (
      <div className="p-8 max-sm:p-4">
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void settings.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      </div>
    )
  }

  const health = s
    ? [
        { label: t('settings.health.api'), status: s.health.api.status, note: '/api' },
        {
          label: t('settings.health.database'),
          status: s.health.database.status,
          note: s.health.database.latency_ms !== null ? t('settings.health.latency', { ms: s.health.database.latency_ms }) : '',
        },
        {
          label: t('settings.health.queue'),
          status: s.health.queue.status,
          note: t('settings.health.failed', { count: s.health.queue.failed_24h ?? 0, driver: s.health.queue.driver }),
        },
        { label: t('settings.health.mail'), status: s.health.mail.status, note: t(s.health.mail.status === 'degraded' ? 'settings.health.driverLog' : 'settings.health.driver', { driver: s.health.mail.driver }) },
      ]
    : []

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <span className="type-label-m inline-flex items-center gap-1.5 rounded-md bg-subtle px-3 py-2 text-secondary">
            <icons.lock aria-hidden size={14} />
            {t('settings.readOnly')}
          </span>
        }
      />
      {!s ? (
        <Skeleton className="h-120 w-full rounded-xl" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex flex-col gap-6">
            <Card title={t('settings.expiry.title')} body={t('settings.expiry.body')}>
              <Facts
                rows={[
                  [t('settings.expiry.default'), t('settings.expiry.defaultValue', { end: s.expiry.default_window_end })],
                  [t('settings.expiry.maxExtension'), t('settings.expiry.maxExtensionValue', { hours: s.expiry.max_extension_hours })],
                  [t('settings.expiry.reminder'), t('settings.expiry.reminderValue', { hours: s.expiry.reminder_hours }), t('settings.expiry.reminderHelp')],
                  [t('settings.expiry.job'), t('settings.expiry.jobValue', { minutes: s.expiry.job_frequency_minutes }), t('settings.expiry.jobHelp')],
                ]}
              />
            </Card>
            <Card title={t('settings.notifications.title')} body={t('settings.notifications.body')}>
              <ul className="flex flex-col gap-3 px-5 py-4">
                {[
                  [t('settings.notifications.owner'), s.notifications.owner_decisions],
                  [t('settings.notifications.savers'), true],
                  [t('settings.notifications.digest'), s.notifications.weekly_digest],
                ].map(([label, on]) => (
                  <li key={String(label)} className="type-body-m flex items-center gap-3 text-primary">
                    <span className={cn('type-label-s w-10 shrink-0 rounded-sm px-1.5 py-0.5 text-center', on ? 'bg-status-success text-status-success' : 'bg-subtle text-secondary')}>
                      {on ? t('settings.on') : t('settings.off')}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title={t('settings.general.title')}>
              <Facts
                rows={[
                  [t('settings.general.name'), s.general.platform_name],
                  [t('settings.general.mapArea'), t('settings.general.mapAreaValue')],
                  [t('settings.general.timezone'), t('settings.general.timezoneValue')],
                ]}
              />
            </Card>
            <Card title={t('settings.retention.title')} body={t('settings.retention.body')}>
              <Facts
                rows={[
                  [t('settings.retention.deleted'), t('settings.retention.daysValue', { count: s.retention.deleted_accounts_days })],
                  [t('settings.retention.deactivated'), t('settings.retention.daysValue', { count: s.retention.deactivated_accounts_days })],
                  [t('settings.retention.saved'), t('settings.retention.daysValue', { count: s.retention.inactive_saved_days })],
                  [t('settings.retention.precision'), t('settings.retention.precisionValue')],
                ]}
              />
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <Card title={t('settings.health.title')} body={t('settings.health.body')}>
              <ul className="flex flex-col gap-3 px-5 py-4">
                {health.map((h) => (
                  <li key={h.label} className="flex items-start justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="type-label-m text-primary">{h.label}</span>
                      <span className="type-mono-s text-tertiary">{h.note}</span>
                    </span>
                    <span className={cn('type-label-s shrink-0 rounded-sm px-1.5 py-0.5', HEALTH_TONE[h.status])}>{t(`settings.health.${h.status}`)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title={t('settings.secrets.title')}>
              <p className="type-body-s flex gap-2 px-5 py-4 text-secondary">
                <icons.lock aria-hidden size={16} className="mt-0.5 shrink-0" />
                {t('settings.secrets.body')}
              </p>
            </Card>
            <Card title={t('settings.version.title')}>
              <dl className="flex flex-col gap-2 px-5 py-4">
                {[
                  [t('settings.version.frontend'), t('settings.version.frontendValue')],
                  [t('settings.version.api'), t('settings.version.apiValue', { ...s.version })],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="type-body-s text-secondary">{label}</dt>
                    <dd className="type-mono-s text-right text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

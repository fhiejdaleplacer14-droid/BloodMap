import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextAreaField } from '../../components/ui/TextAreaField'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { useAdminSettings, useUpdateSettings, type HealthStatus, type SettingValues } from '../../lib/api/admin'
import { errorBody } from '../../lib/api/client'
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

/** A value that changes only through a deployment. */
function Fixed({ label, value, help }: { label: string; value: ReactNode; help?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="type-label-m text-primary">{label}</p>
      <p className="type-body-m rounded-md border border-default bg-canvas px-3 py-2 text-secondary">{value}</p>
      {help && <p className="type-body-s text-secondary">{help}</p>}
    </div>
  )
}

const HEALTH_TONE: Record<HealthStatus, string> = {
  operational: 'bg-status-success text-status-success',
  degraded: 'bg-status-warning text-status-warning',
  down: 'bg-status-critical text-status-critical',
}

type NumberKey = {
  [K in keyof SettingValues]: SettingValues[K] extends number ? K : never
}[keyof SettingValues]

/** Same limits as the server (App\Services\Settings::RULES). */
const RANGES: Record<NumberKey, [number, number]> = {
  'expiry.max_extension_hours': [1, 168],
  'expiry.reminder_hours': [1, 48],
  'retention.deleted_accounts_days': [7, 365],
  'retention.deactivated_accounts_days': [30, 730],
  'retention.inactive_saved_days': [7, 365],
}

type Draft = Omit<SettingValues, NumberKey> & Record<NumberKey, string>

const toDraft = (v: SettingValues): Draft => ({
  ...v,
  ...(Object.fromEntries(Object.keys(RANGES).map((k) => [k, String(v[k as NumberKey])])) as Record<NumberKey, string>),
})

/**
 * Admin / System Settings (41:2021): the editable rules are saved through
 * PATCH /api/admin/settings and audited per key (decision #93); the rest
 * is a read-out. Secrets are never shown.
 */
export function SettingsPage() {
  const { t } = useTranslation(['admin', 'states'])
  useDocumentTitle(t('settings.title'))
  const settings = useAdminSettings()
  const save = useUpdateSettings()
  const s = settings.data
  // Unsaved edits; until the first change the form shows the server values.
  const [edits, setDraft] = useState<Draft | null>(null)
  const draft = edits ?? (s ? toDraft(s.values) : null)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

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

  const errorFor = (key: NumberKey): string | undefined => {
    if (!draft) return undefined
    const [min, max] = RANGES[key]
    const n = Number(draft[key])
    return /^\d+$/.test(draft[key].trim()) && n >= min && n <= max ? undefined : t('settings.range', { min, max })
  }

  const parsed: Partial<SettingValues> = {}
  if (s && draft) {
    for (const key of Object.keys(s.values) as (keyof SettingValues)[]) {
      const value = key in RANGES ? Number(draft[key as NumberKey]) : draft[key]
      if (value !== s.values[key]) Object.assign(parsed, { [key]: value })
    }
  }
  const changedKeys = Object.keys(parsed)
  const retentionChanged = changedKeys.some((k) => k.startsWith('retention.'))
  const invalid = (Object.keys(RANGES) as NumberKey[]).some((k) => errorFor(k) !== undefined)
  const reasonMissing = retentionChanged && reason.trim() === ''

  const onSave = () => {
    setSubmitted(true)
    if (invalid || reasonMissing || changedKeys.length === 0) return
    save.mutate(
      { values: parsed, ...(retentionChanged ? { reason: reason.trim() } : {}) },
      {
        onSuccess: (result) => {
          setDraft(toDraft(result.values))
          setReason('')
          setSubmitted(false)
          toast({ tone: 'success', title: t('settings.saved'), message: t('settings.savedBody', { count: result.changed.length }) })
        },
        onError: (error) => toast({ tone: 'error', title: t('settings.saveFailed'), message: errorBody(error)?.message ?? t('states:networkError.body') }),
      },
    )
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => draft && setDraft({ ...draft, [key]: value })
  const numberField = (key: NumberKey, label: string, help?: string) => (
    <TextField
      label={label}
      inputMode="numeric"
      value={draft?.[key] ?? ''}
      onChange={(e) => set(key, e.target.value)}
      helperText={help}
      error={errorFor(key)}
    />
  )

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
          <Button icon="check" onClick={onSave} loading={save.isPending} disabled={!draft || changedKeys.length === 0}>
            {t('settings.save')}
          </Button>
        }
      />
      {!s || !draft ? (
        <Skeleton className="h-120 w-full rounded-xl" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex flex-col gap-6">
            <Card title={t('settings.expiry.title')} body={t('settings.expiry.body')}>
              <div className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
                <Fixed label={t('settings.expiry.default')} value={t('settings.expiry.defaultValue', { end: s.expiry.default_window_end })} />
                {numberField('expiry.max_extension_hours', t('settings.expiry.maxExtensionHours'), t('settings.expiry.maxExtensionHelp'))}
                {numberField('expiry.reminder_hours', t('settings.expiry.reminderHours'), t('settings.expiry.reminderHelp'))}
                <Fixed
                  label={t('settings.expiry.job')}
                  value={t('settings.expiry.jobValue', { minutes: s.expiry.job_frequency_minutes })}
                  help={t('settings.expiry.jobHelp')}
                />
              </div>
            </Card>
            <Card title={t('settings.notifications.title')} body={t('settings.notifications.body')}>
              <div className="flex flex-col gap-3 px-5 py-4">
                <p className="type-body-m flex items-center gap-2 text-secondary">
                  <icons.lock aria-hidden size={14} className="shrink-0" />
                  {t('settings.notifications.owner')}
                </p>
                <Checkbox
                  label={t('settings.notifications.correction')}
                  checked={draft['notifications.correction_email']}
                  onCheckedChange={(v) => set('notifications.correction_email', v === true)}
                />
                <Checkbox
                  label={t('settings.notifications.digest')}
                  checked={draft['notifications.weekly_digest']}
                  onCheckedChange={(v) => set('notifications.weekly_digest', v === true)}
                />
                <p className="type-body-s text-secondary">{t('settings.notifications.savers')}</p>
              </div>
            </Card>
            <Card title={t('settings.general.title')}>
              <div className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
                <Fixed label={t('settings.general.name')} value={s.general.platform_name} />
                <Fixed label={t('settings.general.mapArea')} value={t('settings.general.mapAreaValue')} />
                <Fixed label={t('settings.general.timezone')} value={t('settings.general.timezoneValue')} />
                <SelectField
                  label={t('settings.general.assistant')}
                  value={draft['general.assistant']}
                  onChange={(e) => set('general.assistant', e.target.value as SettingValues['general.assistant'])}
                  helperText={s.general.assistant_ai_available ? t('settings.general.assistantHelp') : t('settings.general.assistantNoKey')}
                >
                  <option value="ai">{t('settings.general.assistantAi')}</option>
                  <option value="articles">{t('settings.general.assistantArticles')}</option>
                </SelectField>
              </div>
            </Card>
            <Card title={t('settings.retention.title')} body={t('settings.retention.body')}>
              <div className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
                {numberField('retention.deleted_accounts_days', t('settings.retention.deletedDays'))}
                {numberField('retention.deactivated_accounts_days', t('settings.retention.deactivatedDays'))}
                {numberField('retention.inactive_saved_days', t('settings.retention.savedDays'), t('settings.retention.savedHelp'))}
                <Fixed label={t('settings.retention.precision')} value={t('settings.retention.precisionValue')} />
                {retentionChanged && (
                  <TextAreaField
                    className="sm:col-span-2"
                    label={t('settings.retention.reason')}
                    helperText={t('settings.retention.reasonHelp')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxChars={500}
                    charCount={reason.length}
                    error={submitted && reasonMissing ? t('settings.retention.reasonRequired') : undefined}
                  />
                )}
              </div>
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

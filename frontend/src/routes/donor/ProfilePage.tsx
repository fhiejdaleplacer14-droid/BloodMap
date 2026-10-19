import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { icons } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { Switch } from '../../components/ui/Switch'
import { toast } from '../../components/ui/toast'
import { useMe, type Me } from '../../lib/api/auth'
import { useCloseAccount, useEndSession, useSessions, useUpdatePreferences } from '../../lib/api/me'
import { elapsedSince, formatDate, formatShortDateTime } from '../../lib/datetime'
import { devicePrefs, useDevicePref } from '../../lib/devicePrefs'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { ChangePasswordDialog, DeleteAccountDialog, EditAccountDialog } from './ProfileDialogs'

const SECTIONS = ['account', 'visibility', 'notifications', 'privacy', 'security', 'close'] as const
type Section = (typeof SECTIONS)[number]
const NAV_LABEL: Record<Section, string> = {
  account: 'profile.account.title',
  visibility: 'profile.visibility.title',
  notifications: 'profile.notifications.title',
  privacy: 'profile.privacy.title',
  security: 'profile.security.title',
  close: 'profile.close.title',
}

const CheckIcon = icons.check
const CheckCircle = icons['check-circle']
const MinusIcon = icons.minus

function Card({ id, title, subtitle, children }: { id: Section; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section id={`profile-${id}`} aria-labelledby={`profile-${id}-title`} className="scroll-mt-6 overflow-hidden rounded-lg border border-default bg-surface">
      <div className="flex flex-col gap-1 border-b border-default px-6 pt-5 pb-4">
        <h2 id={`profile-${id}-title`} className="type-h4 text-primary">
          {title}
        </h2>
        {subtitle && <p className="type-body-s text-secondary">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-4 px-6 py-5">{children}</div>
    </section>
  )
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-start">
      <dt className="type-body-s w-40 shrink-0 text-secondary">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">{children}</dd>
    </div>
  )
}

function Visibility({ allowed, label }: { allowed: boolean; label: string }) {
  return (
    <span className={`type-body-s inline-flex items-center gap-1.5 ${allowed ? 'text-primary' : 'text-secondary'}`}>
      {allowed ? <CheckIcon aria-hidden size={14} className="text-status-success" /> : <MinusIcon aria-hidden size={14} />}
      {label}
    </span>
  )
}

function Sessions() {
  const { t, i18n } = useTranslation('workspace')
  const sessions = useSessions()
  const end = useEndSession()
  if (sessions.isPending) return <Skeleton className="h-16 w-full rounded-md" />
  return (
    <ul className="flex flex-col gap-3">
      {(sessions.data ?? []).map((session) => (
        <li key={session.id} className="flex items-center gap-3 rounded-md border border-default px-3.5 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="type-label-m text-primary">{session.device ?? t('profile.security.unknownDevice')}</span>
            <span className="type-mono-s text-secondary">
              {session.current ? t('profile.security.now') : formatShortDateTime(session.last_active_at, i18n.language)}
            </span>
          </div>
          {session.current ? (
            <span className="type-label-s rounded-xs bg-subtle px-2 py-0.5 text-secondary">{t('profile.security.thisDevice')}</span>
          ) : (
            <Button variant="secondary" icon="log-out" loading={end.isPending && end.variables === session.id} onClick={() => end.mutate(session.id)}>
              {t('profile.security.signOut')}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function ProfileContent({ me }: { me: Me }) {
  const { t, i18n } = useTranslation(['workspace', 'nav', 'common', 'auth'])
  const navigate = useNavigate()
  const preferences = useUpdatePreferences()
  const close = useCloseAccount()
  const keepRecent = useDevicePref('keepRecentlyViewed')
  const locationSort = useDevicePref('locationSort')
  const [dialog, setDialog] = useState<'edit' | 'password' | 'deactivate' | 'delete' | null>(null)
  const [section, setSection] = useState<Section>('account')

  const setPreference = (key: string, value: boolean) =>
    preferences.mutate(
      { [key]: value },
      {
        onSuccess: () => toast({ tone: 'success', title: t('profile.notifications.saved') }),
        onError: () => toast({ tone: 'error', title: t('auth:errors.generic') }),
      },
    )

  const passwordAge = me.password_changed_at ? elapsedSince(me.password_changed_at) : null
  const visibility: Array<{ key: 'name' | 'email' | 'saved' | 'activity'; admin: string | null }> = [
    { key: 'name', admin: t('profile.visibility.support') },
    { key: 'email', admin: t('profile.visibility.support') },
    { key: 'saved', admin: null },
    { key: 'activity', admin: t('profile.visibility.security') },
  ]

  return (
    <div className="flex gap-8 max-lg:flex-col">
      <nav aria-label={t('profile.sections')} className="sticky top-6 flex w-55 shrink-0 flex-col gap-0.5 self-start max-lg:hidden">
        {SECTIONS.map((key) => (
          <a
            key={key}
            href={`#profile-${key}`}
            aria-current={section === key ? 'location' : undefined}
            onClick={() => setSection(key)}
            className={`type-label-m rounded-sm py-2 pl-3 ${section === key ? 'border border-default bg-surface text-primary' : 'text-secondary hover:text-primary'}`}
          >
            {t(NAV_LABEL[key] as 'profile.account.title')}
          </a>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Card id="account" title={t('profile.account.title')} subtitle={t('profile.account.subtitle')}>
          <dl className="flex flex-col gap-4">
            <FieldRow label={t('profile.account.name')}>
              <span className="type-label-m text-primary">{me.name}</span>
            </FieldRow>
            <FieldRow label={t('profile.account.email')}>
              <span className="type-label-m min-w-0 flex-1 truncate text-primary">{me.email}</span>
              {me.email_verified ? (
                <span className="type-label-s inline-flex items-center gap-1 rounded-xs bg-status-success px-1.5 py-0.5 text-status-success">
                  <CheckCircle aria-hidden size={12} />
                  {t('profile.account.verified')}
                </span>
              ) : (
                <span className="type-label-s rounded-xs bg-status-warning px-1.5 py-0.5 text-status-warning">{t('profile.account.unverified')}</span>
              )}
            </FieldRow>
            {me.member_since && (
              <FieldRow label={t('profile.account.memberSince')}>
                <span className="type-mono-m text-primary">{formatDate(me.member_since, i18n.language)}</span>
              </FieldRow>
            )}
            <FieldRow label={t('profile.account.role')}>
              <span className="type-label-m text-primary">
                {t(`nav:role.${me.role}`, { area: me.area?.short_name ?? '', desk: me.reference ?? '' })}
              </span>
            </FieldRow>
          </dl>
          <div>
            <Button variant="secondary" icon="pencil" onClick={() => setDialog('edit')}>
              {t('profile.account.edit')}
            </Button>
          </div>
        </Card>

        <Card id="visibility" title={t('profile.visibility.title')} subtitle={t('profile.visibility.subtitle')}>
          <div className="overflow-x-auto rounded-md border border-default">
            <table className="w-full min-w-140 border-collapse text-left">
              <caption className="sr-only">{t('profile.visibility.title')}</caption>
              <thead className="bg-subtle">
                <tr className="border-b border-default">
                  {(['information', 'public', 'coordinators', 'administrators'] as const).map((column) => (
                    <th key={column} scope="col" className="type-overline px-3.5 py-2.5 text-secondary">
                      {t(`profile.visibility.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibility.map((row) => (
                  <tr key={row.key} className="border-b border-default last:border-b-0">
                    <th scope="row" className="type-label-m px-3.5 py-3 text-primary">
                      {t(`profile.visibility.rows.${row.key}`)}
                    </th>
                    <td className="px-3.5 py-3">
                      <Visibility allowed={false} label={t('profile.visibility.never')} />
                    </td>
                    <td className="px-3.5 py-3">
                      <Visibility allowed={false} label={t('profile.visibility.never')} />
                    </td>
                    <td className="px-3.5 py-3">
                      <Visibility allowed={row.admin !== null} label={row.admin ?? t('profile.visibility.never')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="type-body-s flex gap-2 text-status-info">
            <icons.info aria-hidden size={16} className="mt-px shrink-0" />
            {t('profile.visibility.note')}
          </p>
        </Card>

        <Card id="notifications" title={t('profile.notifications.title')} subtitle={t('profile.notifications.subtitle')}>
          <Switch
            label={t('profile.notifications.status')}
            checked={me.preferences.email_saved_status_changes ?? false}
            onCheckedChange={(value) => setPreference('email_saved_status_changes', value)}
          />
          <Switch
            label={t('profile.notifications.expiry')}
            checked={me.preferences.email_expiry_reminder ?? false}
            onCheckedChange={(value) => setPreference('email_expiry_reminder', value)}
          />
          <Switch
            label={t('profile.notifications.weekly')}
            checked={me.preferences.email_weekly_area_summary ?? false}
            onCheckedChange={(value) => setPreference('email_weekly_area_summary', value)}
          />
        </Card>

        <Card id="privacy" title={t('profile.privacy.title')} subtitle={t('profile.privacy.subtitle')}>
          <Switch label={t('profile.privacy.location')} checked={locationSort} onCheckedChange={devicePrefs.setLocationSort} />
          <Switch label={t('profile.privacy.recent')} checked={keepRecent} onCheckedChange={devicePrefs.setKeepRecentlyViewed} />
          <div>
            <Button variant="tertiary" onClick={devicePrefs.clearRecentlyViewed}>
              {t('profile.privacy.clear')}
            </Button>
          </div>
        </Card>

        <Card id="security" title={t('profile.security.title')}>
          <Sessions />
          <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
            <div className="flex flex-col gap-0.5">
              <span className="type-label-m text-primary">{t('profile.security.password')}</span>
              <span className="type-body-s text-secondary">
                {passwordAge
                  ? t('profile.security.lastChanged', { when: t(`common:time.ago.${passwordAge.unit}`, { count: passwordAge.count }) })
                  : t('profile.security.neverChanged')}
              </span>
            </div>
            <Button variant="secondary" icon="lock" onClick={() => setDialog('password')}>
              {t('profile.security.change')}
            </Button>
          </div>
        </Card>

        <Card id="close" title={t('profile.close.title')} subtitle={t('profile.close.subtitle')}>
          <div className="flex gap-4 max-md:flex-col">
            <div className="flex flex-1 flex-col items-start gap-2.5 rounded-md border border-default p-4">
              <h3 className="type-label-m text-primary">{t('profile.close.deactivate')}</h3>
              <p className="type-body-s flex-1 text-secondary">{t('profile.close.deactivateBody')}</p>
              <Button variant="secondary" onClick={() => setDialog('deactivate')}>
                {t('profile.close.deactivateButton')}
              </Button>
            </div>
            <div className="flex flex-1 flex-col items-start gap-2.5 rounded-md border border-status-critical p-4">
              <h3 className="type-label-m text-primary">{t('profile.close.delete')}</h3>
              <p className="type-body-s flex-1 text-secondary">{t('profile.close.deleteBody')}</p>
              <Button variant="destructive" icon="trash" onClick={() => setDialog('delete')}>
                {t('profile.close.deleteButton')}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <EditAccountDialog me={me} open={dialog === 'edit'} onOpenChange={(open) => setDialog(open ? 'edit' : null)} />
      <ChangePasswordDialog open={dialog === 'password'} onOpenChange={(open) => setDialog(open ? 'password' : null)} />
      <DeleteAccountDialog me={me} open={dialog === 'delete'} onOpenChange={(open) => setDialog(open ? 'delete' : null)} />
      <ConfirmDialog
        open={dialog === 'deactivate'}
        onOpenChange={(open) => setDialog(open ? 'deactivate' : null)}
        tone="warning"
        icon="alert-triangle"
        title={t('profile.close.deactivateConfirm')}
        description={t('profile.close.deactivateBody')}
        confirmLabel={t('profile.close.deactivateButton')}
        loading={close.isPending}
        onConfirm={() => close.mutate({ mode: 'deactivate' }, { onSuccess: () => navigate('/', { replace: true }) })}
      />
    </div>
  )
}

/** Donor / Profile & Privacy (29:890). */
export function ProfilePage() {
  const { t } = useTranslation('workspace')
  useDocumentTitle(t('crumbs.profile'))
  const { data: me } = useMe()
  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      {me && <ProfileContent me={me} />}
    </div>
  )
}

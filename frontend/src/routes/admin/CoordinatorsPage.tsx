import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { FormDialog } from '../../components/ui/FormDialog'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { useAdminCoordinators, useCoordinatorInviteAction, type CoordinatorInvite } from '../../lib/api/admin'
import { errorBody } from '../../lib/api/client'
import { useMunicipalities } from '../../lib/api/requests'
import { cn } from '../../lib/cn'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { agoLabel } from '../coord/coordText'
import { StatusTag } from './UserDialogs'

const MapPin = icons['map-pin']
const AlertTriangle = icons['alert-triangle']

/** "Invite coordinator" (41:1289, decision #95): name, email and area; the invitee sets their own password. */
function InviteDialog({ open, onOpenChange, defaultArea }: { open: boolean; onOpenChange: (open: boolean) => void; defaultArea?: number }) {
  const { t } = useTranslation(['admin', 'common'])
  const action = useCoordinatorInviteAction()
  const municipalities = useMunicipalities().data ?? []
  const areas = [...new Map(municipalities.map((m) => [m.area.id, m.area])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [area, setArea] = useState(defaultArea ? String(defaultArea) : '')
  const [errors, setErrors] = useState<{ name?: string; email?: string; area?: string }>({})

  const close = (next: boolean) => {
    if (!next) {
      setName('')
      setEmail('')
      setErrors({})
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = {
      name: name.trim() ? undefined : t('invites.nameRequired'),
      email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : t('invites.emailRequired'),
      area: area || defaultArea ? undefined : t('invites.areaRequired'),
    }
    setErrors(next)
    if (next.name || next.email || next.area) return
    action.mutate(
      { kind: 'invite', name: name.trim(), email: email.trim(), area_id: Number(area || defaultArea) },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: t('invites.sent'), message: t('invites.sentBody', { email: email.trim() }) })
          close(false)
        },
        onError: (error) => {
          const body = errorBody(error)
          if (body?.errors?.email) setErrors({ email: body.errors.email[0] })
          else toast({ tone: 'error', title: t('invites.failed'), message: body?.message ?? t('invites.failedBody') })
        },
      },
    )
  }

  return (
    <FormDialog open={open} onOpenChange={close} icon="mail" title={t('invites.title')} description={t('invites.body')}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t('invites.name')} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextField label={t('invites.email')} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <SelectField
          label={t('invites.area')}
          placeholder={t('invites.areaPlaceholder')}
          value={area || (defaultArea ? String(defaultArea) : '')}
          onChange={(e) => setArea(e.target.value)}
          error={errors.area}
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
        <p className="type-body-s text-secondary">{t('invites.expiry')}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => close(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" icon="send" loading={action.isPending}>
            {t('invites.send')}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

function InviteRow({ invite, cell }: { invite: CoordinatorInvite; cell: string }) {
  const { t } = useTranslation('admin')
  const action = useCoordinatorInviteAction()
  const initials = invite.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const run = (kind: 'resend' | 'revoke') =>
    action.mutate(
      { kind, id: invite.id },
      {
        onSuccess: () => toast({ tone: 'success', title: t(kind === 'resend' ? 'invites.resent' : 'invites.revoked'), message: invite.email }),
        onError: () => toast({ tone: 'error', title: t('invites.failed'), message: t('invites.failedBody') }),
      },
    )
  return (
    <tr className="border-t border-default bg-surface">
      <th scope="row" className={cn(cell, 'text-left font-normal')}>
        <span className="flex items-center gap-3">
          <Avatar initials={initials} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="type-label-m truncate text-primary">{invite.name}</span>
            <span className="type-body-s truncate text-secondary">{invite.email}</span>
          </span>
        </span>
      </th>
      <td className={cn(cell, 'type-body-m whitespace-nowrap text-primary')}>
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden size={14} className="text-secondary" />
          {invite.area.short_name}
        </span>
      </td>
      <td className={cell}>
        <span
          className={cn(
            'type-label-s inline-flex rounded-sm px-1.5 py-0.5 whitespace-nowrap',
            invite.expired ? 'bg-status-warning text-status-warning' : 'bg-status-info text-status-info',
          )}
        >
          {t(invite.expired ? 'invites.expired' : 'invites.pending')}
        </span>
      </td>
      <td className={cell}>
        <span className="type-label-s inline-flex rounded-sm bg-status-info px-1.5 py-0.5 text-status-info">{t('invites.invited')}</span>
      </td>
      <td className={cn(cell, 'type-mono-s text-secondary')}>—</td>
      <td className={cell}>
        <span className="flex gap-1">
          <Button variant="secondary" onClick={() => run('resend')} disabled={action.isPending}>
            {t('invites.resend')}
          </Button>
          <Button variant="tertiary" onClick={() => run('revoke')} disabled={action.isPending}>
            {t('invites.revoke')}
          </Button>
        </span>
      </td>
    </tr>
  )
}

/** Admin / Coordinator Management (41:1289): who reviews where, pending invites, and the gaps. */
export function CoordinatorsPage() {
  const { t, i18n } = useTranslation(['admin', 'states'])
  const { t: tCoord } = useTranslation('coord')
  useDocumentTitle(t('coordinators.title'))
  const list = useAdminCoordinators()
  const [now] = useState(() => new Date())
  const [inviting, setInviting] = useState(false)
  const uncovered = list.data?.meta.uncovered_areas ?? []
  const invites = list.data?.meta.invites ?? []
  const areaNames = new Intl.ListFormat(i18n.language, { type: 'disjunction' }).format(uncovered.map((a) => a.name))
  const head = 'type-overline h-10 px-3 text-left font-semibold whitespace-nowrap text-secondary'
  const cell = 'px-3 py-2.5 align-middle'

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('coordinators.title')}
        subtitle={t('coordinators.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/admin/users?role=donor">{t('coordinators.assign')}</Link>
            </Button>
            <Button icon="plus" onClick={() => setInviting(true)}>
              {t('invites.open')}
            </Button>
          </div>
        }
      />

      {uncovered.length > 0 && (
        <p role="note" className="type-body-m flex gap-2 rounded-lg bg-status-warning px-4 py-3 text-status-warning">
          <AlertTriangle aria-hidden size={18} className="mt-0.5 shrink-0" />
          {t('coordinators.uncovered', { count: uncovered.length, areas: areaNames })}
        </p>
      )}

      {list.isPending ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : list.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void list.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : list.data.data.length === 0 && invites.length === 0 ? (
        <EmptyState icon="shield-check" title={tCoord('queue.emptyTitle')} description={t('coordinators.empty')} actions={null} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-default">
          <table className="w-full min-w-220 border-collapse">
            <caption className="sr-only">{t('coordinators.caption')}</caption>
            <thead className="bg-subtle">
              <tr>
                {(['coordinator', 'area', 'authorization', 'account', 'reviews', 'lastActive'] as const).map((key) => (
                  <th key={key} scope="col" className={head}>
                    {t(`coordinators.columns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((c) => (
                <tr key={c.id} className="border-t border-default bg-surface">
                  <th scope="row" className={cn(cell, 'text-left font-normal')}>
                    <span className="flex items-center gap-3">
                      <Avatar initials={c.initials} size="md" />
                      <span className="flex min-w-0 flex-col">
                        <span className="type-label-m truncate text-primary">{c.name}</span>
                        <span className="type-body-s truncate text-secondary">{c.email}</span>
                      </span>
                    </span>
                  </th>
                  <td className={cn(cell, 'type-body-m whitespace-nowrap text-primary')}>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden size={14} className="text-secondary" />
                      {c.area?.short_name ?? t('coordinators.noArea')}
                    </span>
                  </td>
                  <td className={cell}>
                    {c.area && !c.restricted && (
                      <span className="type-label-s inline-flex rounded-sm bg-status-success px-1.5 py-0.5 text-status-success">{t('coordinators.authorized')}</span>
                    )}
                  </td>
                  <td className={cell}>
                    <StatusTag status={c.restricted ? 'restricted' : c.email_verified ? 'active' : 'unverified'} />
                  </td>
                  <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                    {c.reviews_30d.approved} / {c.reviews_30d.corrections} / {c.reviews_30d.rejected}
                  </td>
                  <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                    {c.last_active_at ? agoLabel(c.last_active_at, tCoord, now) : '—'}
                  </td>
                </tr>
              ))}
              {invites.map((invite) => (
                <InviteRow key={invite.id} invite={invite} cell={cell} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <InviteDialog open={inviting} onOpenChange={setInviting} defaultArea={uncovered[0]?.id} />
    </div>
  )
}

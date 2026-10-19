import { useState } from 'react'
import { Dialog, RadioGroup as RadixRadioGroup } from 'radix-ui'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { FormDialog } from '../../components/ui/FormDialog'
import { IconButton } from '../../components/ui/IconButton'
import { icons } from '../../components/ui/icons'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { useAdminUser, useAdminUserAction, type AdminUser } from '../../lib/api/admin'
import type { Me, Role } from '../../lib/api/auth'
import { useOwnCoordinationPoints } from '../../lib/api/myRequests'
import { useMunicipalities } from '../../lib/api/requests'
import { cn } from '../../lib/cn'
import { formatCalendarDate, formatShortDateTime } from '../../lib/datetime'

const ROLES: Role[] = ['donor', 'facility_submitter', 'coordinator', 'admin']

export function StatusTag({ status }: { status: AdminUser['status'] }) {
  const { t } = useTranslation('admin')
  const tone = {
    active: 'bg-status-success text-status-success',
    unverified: 'bg-status-warning text-status-warning',
    restricted: 'bg-subtle text-secondary',
  }[status]
  return <span className={cn('type-label-s inline-flex rounded-sm px-1.5 py-0.5', tone)}>{t(`status.${status}`)}</span>
}

type Dialogs = 'role' | 'restrict' | 'unrestrict' | null

/** Account details drawer (39:833): right sheet, 480 w. Nothing private is ever fetched. */
export function UserDrawer({ userId, me, onClose }: { userId: number | null; me: Me; onClose: () => void }) {
  const { t, i18n } = useTranslation(['admin', 'states', 'common'])
  const detail = useAdminUser(userId)
  const action = useAdminUserAction()
  const [dialog, setDialog] = useState<Dialogs>(null)
  const u = detail.data
  const self = u?.id === me.id
  const locale = i18n.language
  const failed = () => toast({ tone: 'error', title: t('drawer.failed'), message: t('drawer.failedBody') })

  const rows: [string, string][] = u
    ? [
        [t('drawer.role'), t(`roles.${u.role}`)],
        ...(u.area
          ? [[t('drawer.area'), u.area_municipalities !== null ? t('drawer.areaMunicipalities', { area: u.area.name, count: u.area_municipalities }) : u.area.name] as [string, string]]
          : []),
        ...(u.coordination_point ? [[t('drawer.desk'), u.coordination_point.name] as [string, string]] : []),
        [t('drawer.memberSince'), formatCalendarDate(u.created_at.slice(0, 10), locale)],
        [
          t('drawer.lastSignIn'),
          u.last_sign_in ? [formatShortDateTime(u.last_sign_in.at, locale), u.last_sign_in.device].filter(Boolean).join(' · ') : t('users.never'),
        ],
        ...(u.reviews_30d
          ? [[t('drawer.reviews'), t('drawer.reviewsValue', { ...u.reviews_30d })] as [string, string]]
          : []),
        ...(u.restriction_reason ? [[t('drawer.restrictedReason'), u.restriction_reason] as [string, string]] : []),
      ]
    : []

  return (
    <Dialog.Root open={userId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/48" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-40 flex w-120 max-w-full flex-col bg-surface shadow-overlay">
          <div className="flex items-center justify-between border-b border-default px-6 py-4">
            <Dialog.Title className="type-h3 text-primary">{t('drawer.title')}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon="x" label={t('common:actions.close')} tooltip={false} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t('drawer.hiddenBody')}</Dialog.Description>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {detail.isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : detail.isError || !u ? (
              <p role="alert" className="type-body-m text-status-critical">
                {t('states:networkError.title')}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <Avatar initials={u.initials} size="lg" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="type-h3 truncate text-primary">{u.name}</p>
                    <p className="type-body-s truncate text-secondary">{u.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusTag status={u.status} />
                      <span
                        className={cn(
                          'type-label-s inline-flex rounded-sm px-1.5 py-0.5',
                          u.email_verified ? 'bg-status-info text-status-info' : 'bg-status-warning text-status-warning',
                        )}
                      >
                        {u.email_verified ? t('drawer.emailVerified') : t('drawer.emailUnverified')}
                      </span>
                    </div>
                  </div>
                </div>

                <dl className="overflow-hidden rounded-lg border border-default">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex gap-3 border-b border-default px-3 py-2.5 last:border-b-0">
                      <dt className="type-body-s w-30 shrink-0 text-secondary">{label}</dt>
                      <dd className="type-body-m min-w-0 flex-1 break-words text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-col gap-1 rounded-lg bg-canvas px-4 py-3">
                  <p className="type-label-m flex items-center gap-2 text-primary">
                    <icons.lock aria-hidden size={16} />
                    {t('drawer.hiddenTitle')}
                  </p>
                  <p className="type-body-s text-secondary">{t('drawer.hiddenBody')}</p>
                </div>

                {u.pending_role_change && (
                  <div className="flex flex-col gap-2 rounded-lg bg-status-warning px-4 py-3 text-status-warning">
                    <p className="type-body-s">{t('drawer.pending', { role: t(`roles.${u.pending_role_change.to_role}`) })}</p>
                    {u.pending_role_change.requested_by !== me.id && (
                      <div className="flex gap-2">
                        {(['approve', 'decline'] as const).map((kind) => (
                          <Button
                            key={kind}
                            variant={kind === 'approve' ? 'primary' : 'secondary'}
                            disabled={action.isPending}
                            onClick={() =>
                              action.mutate(
                                { kind, id: u.id, changeId: u.pending_role_change!.id },
                                { onSuccess: () => toast({ tone: 'success', title: t(kind === 'approve' ? 'drawer.approved' : 'drawer.declined') }), onError: failed },
                              )
                            }
                          >
                            {t(`drawer.${kind}`)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className="type-overline text-tertiary">{t('drawer.actions')}</h3>
                  {self ? (
                    <p className="type-body-s text-secondary">{t('drawer.self')}</p>
                  ) : (
                    <>
                      <Button variant="secondary" icon="shield-check" onClick={() => setDialog('role')} disabled={Boolean(u.pending_role_change)}>
                        {t('drawer.changeRole')}
                      </Button>
                      <Button
                        variant="secondary"
                        icon="mail"
                       
                        loading={action.isPending && action.variables?.kind === 'reset'}
                        onClick={() =>
                          action.mutate(
                            { kind: 'reset', id: u.id },
                            { onSuccess: () => toast({ tone: 'success', title: t('drawer.resetSent'), message: t('drawer.resetSentBody', { email: u.email }) }), onError: failed },
                          )
                        }
                      >
                        {t('drawer.sendReset')}
                      </Button>
                    </>
                  )}
                  <Button asChild variant="secondary">
                    <Link to={`/admin/audit?actor=${u.id}`} onClick={onClose}>
                      <icons.history aria-hidden size={16} />
                      {t('drawer.history')}
                    </Link>
                  </Button>
                  {!self &&
                    (u.restricted ? (
                      <Button variant="secondary" icon="refresh" onClick={() => setDialog('unrestrict')}>
                        {t('drawer.unrestrict')}
                      </Button>
                    ) : (
                      <Button variant="destructive" icon="ban" onClick={() => setDialog('restrict')}>
                        {t('drawer.restrict')}
                      </Button>
                    ))}
                </section>
                <p className="type-body-s flex gap-2 text-secondary">
                  <icons.info aria-hidden size={14} className="mt-0.5 shrink-0" />
                  {t('drawer.note')}
                </p>
              </>
            )}
          </div>
          {u && <RoleDialog user={u} open={dialog === 'role'} onOpenChange={(open) => setDialog(open ? 'role' : null)} />}
          {u && <RestrictDialog user={u} mode={dialog === 'unrestrict' ? 'unrestrict' : 'restrict'} open={dialog === 'restrict' || dialog === 'unrestrict'} onOpenChange={(open) => !open && setDialog(null)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Change role (39:1074): role cards, area for coordinators, desk for submitters, reason for the audit log. */
function RoleDialog({ user, open, onOpenChange }: { user: AdminUser; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['admin', 'common'])
  const action = useAdminUserAction()
  const municipalities = useMunicipalities().data ?? []
  const points = useOwnCoordinationPoints().data ?? []
  const areas = [...new Map(municipalities.map((m) => [m.area.id, m.area])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const [role, setRole] = useState<Role>(user.role)
  const [area, setArea] = useState(user.area ? String(user.area.id) : '')
  const [desk, setDesk] = useState(user.coordination_point ? String(user.coordination_point.id) : '')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ area?: string; desk?: string; reason?: string }>({})

  const save = () => {
    const next = {
      area: role === 'coordinator' && !area ? t('role.areaRequired') : undefined,
      desk: role === 'facility_submitter' && !desk ? t('role.deskRequired') : undefined,
      reason: reason.trim().length < 3 ? t('role.reasonRequired') : undefined,
    }
    setErrors(next)
    if (next.area || next.desk || next.reason) return
    action.mutate(
      {
        kind: 'role',
        id: user.id,
        role,
        area_id: role === 'coordinator' ? Number(area) : null,
        coordination_point_id: role === 'facility_submitter' ? Number(desk) : null,
        reason: reason.trim(),
      },
      {
        onSuccess: ({ pending }) => {
          onOpenChange(false)
          setReason('')
          toast(
            pending
              ? { tone: 'info', title: t('role.pending'), message: t('role.pendingBody', { name: user.name }) }
              : { tone: 'success', title: t('role.saved'), message: t('role.savedBody', { name: user.name, role: t(`roles.${role}`) }) },
          )
        },
        onError: () => toast({ tone: 'error', title: t('drawer.failed'), message: t('drawer.failedBody') }),
      },
    )
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('role.title')} description={`${user.name} · ${user.email}`}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        className="flex flex-col gap-4"
      >
        <RadixRadioGroup.Root aria-label={t('role.title')} value={role} onValueChange={(value) => setRole(value as Role)} className="flex flex-col gap-2">
          {ROLES.map((value) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5',
                role === value ? 'border-2 border-brand bg-brand-soft px-2.75 py-2.25' : 'border-default hover:border-strong',
              )}
            >
              <RadixRadioGroup.Item
                value={value}
                className="mt-0.5 size-5 shrink-0 rounded-full border border-strong bg-surface data-[state=checked]:border-[6px] data-[state=checked]:border-(--text-primary)"
              />
              <span className="flex flex-col">
                <span className="type-label-m text-primary">{t(`roles.${value}`)}</span>
                <span className="type-body-s text-secondary">{t(`role.descriptions.${value}`)}</span>
              </span>
            </label>
          ))}
        </RadixRadioGroup.Root>
        {role === 'coordinator' && (
          <SelectField label={t('role.area')} helperText={t('role.areaHelp')} error={errors.area} value={area} onChange={(e) => setArea(e.target.value)} placeholder={t('role.chooseArea')}>
            {areas.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.name}
              </option>
            ))}
          </SelectField>
        )}
        {role === 'facility_submitter' && (
          <SelectField label={t('role.desk')} helperText={t('role.deskHelp')} error={errors.desk} value={desk} onChange={(e) => setDesk(e.target.value)} placeholder={t('role.chooseDesk')}>
            {points.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </SelectField>
        )}
        <TextField label={t('role.reason')} value={reason} error={errors.reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Dialog.Close asChild>
            <Button variant="secondary">{t('role.cancel')}</Button>
          </Dialog.Close>
          <Button type="submit" variant="primary" icon="check" loading={action.isPending} disabled={role === user.role && role !== 'coordinator' && role !== 'facility_submitter'}>
            {t('role.save')}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

const RESTRICT_REASONS = ['spam', 'impersonation', 'personal_data', 'owner_request'] as const

/** Restrict account (39:1286) — and its reverse, which the dialog promises ("You can lift the restriction later"). */
function RestrictDialog({ user, mode, open, onOpenChange }: { user: AdminUser; mode: 'restrict' | 'unrestrict'; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('admin')
  const action = useAdminUserAction()
  const [reasonKey, setReasonKey] = useState<(typeof RESTRICT_REASONS)[number]>('spam')
  const [liftReason, setLiftReason] = useState('')
  const [error, setError] = useState<string>()
  const lifting = mode === 'unrestrict'

  const confirm = () => {
    const reason = lifting ? liftReason.trim() : t(`restrict.reasons.${reasonKey}`)
    if (lifting && reason.length < 3) return setError(t('restrict.liftRequired'))
    action.mutate(
      { kind: mode, id: user.id, reason },
      {
        onSuccess: () => {
          onOpenChange(false)
          setLiftReason('')
          toast(lifting ? { tone: 'success', title: t('restrict.lifted') } : { tone: 'info', title: t('restrict.done'), message: t('restrict.doneBody', { name: user.name }) })
        },
        onError: () => toast({ tone: 'error', title: t('drawer.failed'), message: t('drawer.failedBody') }),
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={lifting ? t('restrict.liftTitle', { name: user.name }) : t('restrict.title', { name: user.name })}
      description={lifting ? t('restrict.liftBody') : t('restrict.body')}
      icon={lifting ? 'refresh' : 'ban'}
      tone={lifting ? 'neutral' : 'critical'}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          confirm()
        }}
        className="flex flex-col gap-4"
      >
        {lifting ? (
          <TextField
            label={t('restrict.liftReason')}
            helperText={t('restrict.liftHelp')}
            error={error}
            value={liftReason}
            onChange={(e) => {
              setLiftReason(e.target.value)
              setError(undefined)
            }}
          />
        ) : (
          <SelectField label={t('restrict.reason')} helperText={t('restrict.reasonHelp')} value={reasonKey} onChange={(e) => setReasonKey(e.target.value as (typeof RESTRICT_REASONS)[number])}>
            {RESTRICT_REASONS.map((key) => (
              <option key={key} value={key}>
                {t(`restrict.reasons.${key}`)}
              </option>
            ))}
          </SelectField>
        )}
        <div className="flex justify-end gap-2">
          <Dialog.Close asChild>
            <Button variant="secondary">{t('role.cancel')}</Button>
          </Dialog.Close>
          <Button type="submit" variant={lifting ? 'primary' : 'destructive'} icon={lifting ? 'refresh' : 'ban'} loading={action.isPending}>
            {lifting ? t('restrict.liftConfirm') : t('restrict.confirm')}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

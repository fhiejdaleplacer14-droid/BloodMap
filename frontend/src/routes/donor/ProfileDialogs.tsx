import { useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog } from 'radix-ui'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { icons, type IconName } from '../../components/ui/icons'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import type { Me } from '../../lib/api/auth'
import { errorBody, errorStatus } from '../../lib/api/client'
import { useCloseAccount, useUpdateAccount, useUpdatePassword } from '../../lib/api/me'
import { cn } from '../../lib/cn'
import { isBreachedPasswordMessage, meetsPasswordRules } from '../auth/authUtils'
import { PasswordRequirements } from '../auth/PasswordRequirements'

/** Modal Dialog (10:464): 480 w, radius 16, Elevation/3 over a 48 % scrim; Esc and ✕ cancel. */
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  tone = 'neutral',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  icon?: IconName
  tone?: 'neutral' | 'critical'
  children: ReactNode
}) {
  const { t } = useTranslation()
  const Icon = icon ? icons[icon] : null
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/48" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-120 max-w-[calc(100vw-32px)] -translate-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-6 shadow-overlay">
          <div className="flex items-start gap-3">
            {Icon && (
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-md',
                  tone === 'critical' ? 'bg-status-critical text-status-critical' : 'bg-subtle text-primary',
                )}
              >
                <Icon aria-hidden size={20} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="type-h3 text-primary">{title}</Dialog.Title>
              <Dialog.Description className="type-body-m text-secondary">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton icon="x" label={t('actions.close')} tooltip={false} className="-mt-2 -mr-2" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function EditAccountDialog({ me, open, onOpenChange }: { me: Me; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['workspace', 'auth', 'common'])
  const update = useUpdateAccount()
  const schema = z.object({ name: z.string().trim().min(1, t('auth:errors.nameRequired')).max(120), email: z.email(t('auth:errors.email')) })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { name: me.name, email: me.email } })

  const submit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', title: t('profile.account.saved') })
        onOpenChange(false)
      },
      onError: (error) => {
        const errors = errorStatus(error) === 422 ? errorBody(error)?.errors : undefined
        if (errors?.email) form.setError('email', { message: errors.email[0] })
        else toast({ tone: 'error', title: t('auth:errors.generic') })
      },
    }),
  )

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('profile.account.editTitle')} description={t('profile.account.editBody')} icon="pencil">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t('auth:fields.name')} autoComplete="name" error={form.formState.errors.name?.message} {...form.register('name')} />
        <TextField
          label={t('auth:fields.email')}
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close asChild>
            <Button variant="secondary">{t('common:actions.cancel')}</Button>
          </Dialog.Close>
          <Button type="submit" variant="primary" loading={update.isPending}>
            {t('profile.account.save')}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['workspace', 'auth', 'common'])
  const update = useUpdatePassword()
  const [commonRejected, setCommonRejected] = useState(false)
  const schema = z
    .object({
      current_password: z.string().min(1, t('auth:errors.passwordRequired')),
      password: z.string().refine(meetsPasswordRules, t('auth:errors.passwordRules')),
      password_confirmation: z.string(),
    })
    .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: t('auth:errors.mismatch') })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current_password: '', password: '', password_confirmation: '' } })
  const password = useWatch({ control: form.control, name: 'password' })

  const submit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', title: t('profile.security.updated') })
        form.reset()
        onOpenChange(false)
      },
      onError: (error) => {
        const errors = errorStatus(error) === 422 ? errorBody(error)?.errors : undefined
        if (!errors) return void toast({ tone: 'error', title: t('auth:errors.generic') })
        if (errors.current_password) form.setError('current_password', { message: errors.current_password[0] })
        if (errors.password) {
          if (errors.password.some(isBreachedPasswordMessage)) setCommonRejected(true)
          form.setError('password', { message: errors.password[0] })
        }
      },
    }),
  )

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('profile.security.change')} description={t('profile.security.changeBody')} icon="lock">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <input type="email" name="username" autoComplete="username" hidden readOnly />
        <TextField
          label={t('profile.security.current')}
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.current_password?.message}
          {...form.register('current_password')}
        />
        <TextField
          label={t('profile.security.new')}
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          {...form.register('password', { onChange: () => setCommonRejected(false) })}
        />
        <PasswordRequirements value={password} commonRejected={commonRejected} />
        <TextField
          label={t('profile.security.confirm')}
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.password_confirmation?.message}
          {...form.register('password_confirmation')}
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close asChild>
            <Button variant="secondary">{t('common:actions.cancel')}</Button>
          </Dialog.Close>
          <Button type="submit" variant="primary" loading={update.isPending}>
            {t('profile.security.update')}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

/** Dialog · Delete account (29:1419): typed-email confirmation. */
export function DeleteAccountDialog({ me, open, onOpenChange }: { me: Me; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['workspace', 'auth'])
  const navigate = useNavigate()
  const close = useCloseAccount()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()

  const confirm = () => {
    if (value.trim().toLowerCase() !== me.email.toLowerCase()) {
      setError(t('profile.close.mismatch'))
      return
    }
    close.mutate(
      { mode: 'delete', confirmation: me.email },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: () => setError(t('auth:errors.generic')),
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue('')
          setError(undefined)
        }
        onOpenChange(next)
      }}
      title={t('profile.close.dialogTitle')}
      description={t('profile.close.dialogBody')}
      icon="alert-triangle"
      tone="critical"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          confirm()
        }}
        className="flex flex-col gap-4"
      >
        <TextField
          label={t('profile.close.confirmLabel')}
          type="email"
          autoComplete="off"
          helperText={t('profile.close.confirmHelper')}
          error={error}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(undefined)
          }}
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close asChild>
            <Button variant="secondary">{t('profile.close.keep')}</Button>
          </Dialog.Close>
          <Button type="submit" variant="destructive" icon="trash" loading={close.isPending}>
            {t('profile.close.confirmDelete')}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

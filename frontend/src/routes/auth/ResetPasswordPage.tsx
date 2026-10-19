import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { useResetPassword } from '../../lib/api/auth'
import { errorBody, errorStatus } from '../../lib/api/client'
import { AuthHeading, AuthLayout, BackToSignIn, Banner, IconTile } from './AuthLayout'
import { isBreachedPasswordMessage, meetsPasswordRules } from './authUtils'
import { PasswordRequirements } from './PasswordRequirements'

/** Auth / Recovery — Set new password (23:1462) · Expired link (23:1349). */
export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')
  const reset = useResetPassword()
  const [expired, setExpired] = useState(!token || !email)
  const [commonRejected, setCommonRejected] = useState(false)

  const schema = z
    .object({
      password: z.string().refine(meetsPasswordRules, t('errors.passwordRules')),
      password_confirmation: z.string(),
    })
    .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: t('errors.mismatch') })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', password_confirmation: '' } })
  const password = useWatch({ control: form.control, name: 'password' })

  const onSubmit = form.handleSubmit((values) =>
    reset.mutate(
      { token: token ?? '', email: email ?? '', ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: t('recovery.updated') })
          navigate('/login', { replace: true })
        },
        onError: (error) => {
          const body = errorBody(error)
          if (body?.code === 'invalid_token') {
            setExpired(true)
            return
          }
          const passwordErrors = errorStatus(error) === 422 ? body?.errors?.password : undefined
          if (passwordErrors?.length) {
            if (passwordErrors.some((m) => isBreachedPasswordMessage(m))) setCommonRejected(true)
            form.setError('password', { message: passwordErrors[0] })
          }
        },
      },
    ),
  )

  if (expired) {
    return (
      <AuthLayout title={t('recovery.expiredTitle')}>
        <BackToSignIn />
        <IconTile icon="hourglass" tone="neutral" />
        <AuthHeading title={t('recovery.expiredTitle')} subtitle={t('recovery.expiredBody')} />
        <Button asChild variant="primary" className="w-full">
          <Link to="/forgot-password">{t('recovery.requestNew')}</Link>
        </Button>
      </AuthLayout>
    )
  }

  const unexpected = reset.error && errorStatus(reset.error) !== 422

  return (
    <AuthLayout title={t('recovery.newTitle')}>
      <BackToSignIn />
      <AuthHeading title={t('recovery.newTitle')} subtitle={t('recovery.newSubtitle')} />
      {unexpected && <Banner tone="critical" title={t('errors.generic')} />}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* Lets password managers pair the new password with the account. */}
        <input type="email" name="username" autoComplete="username" value={email ?? ''} readOnly hidden />
        <TextField
          label={t('fields.newPassword')}
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          {...form.register('password', { onChange: () => setCommonRejected(false) })}
        />
        <PasswordRequirements id="new-password-requirements" value={password} commonRejected={commonRejected} />
        <TextField
          label={t('fields.confirmNewPassword')}
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.password_confirmation?.message}
          {...form.register('password_confirmation')}
        />
        <Button type="submit" variant="primary" className="w-full" loading={reset.isPending}>
          {t('recovery.update')}
        </Button>
      </form>
    </AuthLayout>
  )
}

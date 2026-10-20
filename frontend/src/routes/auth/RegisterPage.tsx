import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { TextField } from '../../components/ui/TextField'
import { icons } from '../../components/ui/icons'
import { useRegister, useResendVerification } from '../../lib/api/auth'
import { errorBody, errorStatus } from '../../lib/api/client'
import { AuthHeading, AuthLayout, Banner, IconTile } from './AuthLayout'
import { isBreachedPasswordMessage, maskEmail, meetsPasswordRules } from './authUtils'
import { ErrorSummary, type SummaryError } from '../../components/ui/ErrorSummary'
import { PasswordRequirements } from './PasswordRequirements'

const AlertCircle = icons['alert-circle']
const RESEND_SECONDS = 60

/** "Check your inbox" (23:883) with a resend countdown. */
function CheckInbox({ email }: { email: string }) {
  const { t } = useTranslation('auth')
  const resend = useResendVerification()
  const [seconds, setSeconds] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <>
      <IconTile icon="mail" tone="success" />
      <AuthHeading title={t('verify.title')} subtitle={t('verify.body', { email: maskEmail(email) })} />
      <Button asChild variant="primary" className="w-full">
        <Link to="/login">{t('verify.continue')}</Link>
      </Button>
      <p className="type-body-m flex items-center justify-center gap-1.5 text-secondary" aria-live="polite">
        {t('verify.didntGet')}
        {seconds > 0 ? (
          <span className="type-mono-m text-tertiary">{t('verify.resendIn', { time })}</span>
        ) : (
          <button
            type="button"
            disabled={resend.isPending}
            onClick={() => resend.mutate(email, { onSettled: () => setSeconds(RESEND_SECONDS) })}
            className="type-label-m rounded-sm text-link hover:underline disabled:text-tertiary"
          >
            {t('verify.resend')}
          </button>
        )}
      </p>
      <Banner tone="info">{t('verify.wrongAddress')}</Banner>
    </>
  )
}

/** Auth / Register (23:537 · Validation 23:707 · Success 23:883). */
export function RegisterPage() {
  const { t } = useTranslation('auth')
  const register = useRegister()
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [commonRejected, setCommonRejected] = useState(false)

  const schema = z
    .object({
      name: z.string().trim().min(1, t('errors.nameRequired')).max(120),
      email: z.email(t('errors.email')),
      password: z.string().refine(meetsPasswordRules, t('errors.passwordRules')),
      password_confirmation: z.string(),
      terms: z.boolean().refine((v) => v, t('errors.terms')),
      email_saved_status_changes: z.boolean(),
    })
    .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: t('errors.mismatch') })
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', password_confirmation: '', terms: false, email_saved_status_changes: false },
    // The error summary takes focus instead (55:439).
    shouldFocusError: false,
  })
  const password = useWatch({ control: form.control, name: 'password' })
  const { errors, submitCount } = form.formState
  const labels: Record<string, string> = {
    name: t('fields.name'),
    email: t('fields.email'),
    password: t('fields.password'),
    password_confirmation: t('fields.confirmPassword'),
    terms: t('register.termsLabel'),
  }
  const summary: SummaryError[] =
    submitCount > 0
      ? Object.keys(labels).flatMap((name) => {
          const message = errors[name as keyof typeof errors]?.message
          return message ? [{ name, label: labels[name], message }] : []
        })
      : []


  const onSubmit = form.handleSubmit((values) =>
    register.mutate(values, {
      onSuccess: () => setRegisteredEmail(values.email),
      onError: (error) => {
        // Map server validation (e.g. a breached password) onto the fields.
        const fieldErrors = errorStatus(error) === 422 ? errorBody(error)?.errors : undefined
        if (!fieldErrors) return
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (field === 'password' && messages.some((m) => isBreachedPasswordMessage(m))) setCommonRejected(true)
          if (field in values) form.setError(field as keyof Values, { message: messages[0] })
        }
      },
    }),
  )

  if (registeredEmail) {
    return (
      <AuthLayout title={t('verify.title')}>
        <CheckInbox email={registeredEmail} />
      </AuthLayout>
    )
  }

  const unexpected = register.error && errorStatus(register.error) !== 422

  return (
    <AuthLayout title={t('register.title')}>
      <AuthHeading title={t('register.title')} subtitle={t('register.subtitle')} />
      {unexpected && <Banner tone="critical" title={t('errors.generic')} />}
      <ErrorSummary errors={summary} onSelect={(name) => form.setFocus(name as keyof Values)} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <TextField label={t('fields.name')} autoComplete="name" error={errors.name?.message} {...form.register('name')} />
        <TextField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          helperText={t('fields.emailHelper')}
          error={errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...form.register('password', { onChange: () => setCommonRejected(false) })}
        />
        <PasswordRequirements id="password-requirements" value={password} commonRejected={commonRejected} />
        <TextField
          label={t('fields.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.password_confirmation?.message}
          {...form.register('password_confirmation')}
        />
        <div className="flex flex-col gap-2">
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <Checkbox
                label={t('register.terms')}
                checked={field.value}
                aria-invalid={Boolean(errors.terms) || undefined}
                aria-describedby={errors.terms ? 'terms-error' : undefined}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          {errors.terms && (
            <p id="terms-error" className="type-body-s flex items-center gap-1 pl-7 text-status-critical">
              <AlertCircle aria-hidden size={14} className="shrink-0" />
              {errors.terms.message}
            </p>
          )}
          <Controller
            control={form.control}
            name="email_saved_status_changes"
            render={({ field }) => (
              <Checkbox
                label={t('register.updates')}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
        </div>
        <Button type="submit" variant="primary" className="w-full" loading={register.isPending}>
          {t('register.submit')}
        </Button>
      </form>
      <p className="type-body-m flex flex-wrap justify-center gap-1.5 text-secondary">
        {t('register.haveAccount')}
        <Link to="/login" className="type-label-m rounded-sm text-link hover:underline">
          {t('register.logIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { TextField } from '../../components/ui/TextField'
import { icons } from '../../components/ui/icons'
import { homeFor, useLogin } from '../../lib/api/auth'
import { errorBody, errorStatus } from '../../lib/api/client'
import { AuthHeading, AuthLayout, Banner } from './AuthLayout'
import { safeNext } from './authUtils'

const ShieldCheck = icons['shield-check']

/** Auth / Login (23:2 · Validation 23:134 · Error feedback 23:271 · Submitting 23:409). */
export function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')
  const login = useLogin()

  const schema = z.object({
    email: z.email(t('errors.email')),
    password: z.string().min(1, t('errors.passwordRequired')),
    remember: z.boolean(),
  })
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', remember: false },
  })

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, { onSuccess: (me) => navigate(safeNext(next, homeFor(me)), { replace: true }) }),
  )

  // 422 = wrong email or password (generic, no enumeration); 429 locked out; 403 restricted.
  const status = errorStatus(login.error)
  const body = errorBody(login.error)
  const banner = !login.error ? null : status === 422 ? (
    <Banner tone="critical" title={t('login.incorrectTitle')}>
      {t('login.incorrectBody')}
    </Banner>
  ) : status === 429 || status === 403 ? (
    <Banner tone="critical" title={body?.message} />
  ) : (
    <Banner tone="critical" title={t('errors.generic')} />
  )

  return (
    <AuthLayout title={t('login.title')}>
      <AuthHeading title={t('login.title')} subtitle={t('login.subtitle')} />
      {banner}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <TextField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          label={t('fields.password')}
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Controller
            control={form.control}
            name="remember"
            render={({ field }) => (
              <Checkbox
                label={t('login.remember')}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Link to="/forgot-password" className="type-label-m rounded-sm text-link hover:underline">
            {t('login.forgot')}
          </Link>
        </div>
        <Button type="submit" variant="primary" className="w-full" loading={login.isPending}>
          {t('login.submit')}
        </Button>
      </form>
      <p className="type-body-m flex flex-wrap justify-center gap-1.5 text-secondary">
        {t('login.newHere')}
        <Link to="/register" className="type-label-m rounded-sm text-link hover:underline">
          {t('login.createAccount')}
        </Link>
      </p>
      <p className="type-body-s flex gap-2 border-t border-default pt-4 text-tertiary">
        <ShieldCheck aria-hidden size={16} className="mt-px shrink-0" />
        {t('login.roleNote')}
      </p>
    </AuthLayout>
  )
}

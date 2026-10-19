import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { useForgotPassword } from '../../lib/api/auth'
import { AuthHeading, AuthLayout, BackToSignIn, Banner, IconTile } from './AuthLayout'

/** Auth / Recovery — Request link (23:997) · Invalid email (23:1112) · Link sent (23:1229). */
export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const forgot = useForgotPassword()
  const [sentTo, setSentTo] = useState<string | null>(null)

  const schema = z.object({ email: z.email(t('errors.email')) })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = form.handleSubmit((values) => forgot.mutate(values.email, { onSuccess: () => setSentTo(values.email) }))

  if (sentTo) {
    return (
      <AuthLayout title={t('recovery.sentTitle')}>
        <BackToSignIn />
        <IconTile icon="mail" tone="info" />
        <AuthHeading title={t('recovery.sentTitle')} subtitle={t('recovery.sentBody', { email: sentTo })} />
        {/* Same message whether or not the email is registered (no enumeration). */}
        <Banner tone="info">{t('recovery.privacyNote')}</Banner>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setSentTo(null)
            form.reset({ email: '' })
          }}
        >
          {t('recovery.differentEmail')}
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('recovery.title')}>
      <BackToSignIn />
      <AuthHeading title={t('recovery.title')} subtitle={t('recovery.subtitle')} />
      {forgot.isError && <Banner tone="critical" title={t('errors.generic')} />}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <TextField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Button type="submit" variant="primary" className="w-full" loading={forgot.isPending}>
          {t('recovery.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}

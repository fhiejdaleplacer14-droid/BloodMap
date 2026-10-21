import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { meKey, type Me } from '../../lib/api/auth'
import { api, errorBody, errorStatus } from '../../lib/api/client'
import { AuthHeading, AuthLayout, Banner, IconTile } from './AuthLayout'
import { isBreachedPasswordMessage, meetsPasswordRules } from './authUtils'
import { PasswordRequirements } from './PasswordRequirements'

type InviteInfo = { name: string; email: string; area: string; expires_at: string }

/**
 * Accept a coordinator invite (decision #95): the emailed link proves the
 * address, so the invitee only confirms their name and sets a password,
 * then lands in their review workspace.
 */
export function InvitePage() {
  const { t } = useTranslation('auth')
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [commonRejected, setCommonRejected] = useState(false)

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: async ({ signal }) => (await api.get<{ data: InviteInfo }>(`/api/invites/${encodeURIComponent(token)}`, { signal })).data.data,
    retry: false,
  })
  const accept = useMutation({
    mutationFn: async (values: { name: string; password: string; password_confirmation: string }) =>
      (await api.post<{ data: Me }>(`/invites/${encodeURIComponent(token)}/accept`, values)).data.data,
    onSuccess: (me) => client.setQueryData(meKey, me),
  })

  const schema = z
    .object({
      name: z.string().trim().min(1, t('errors.nameRequired')).max(120),
      password: z.string().refine(meetsPasswordRules, t('errors.passwordRules')),
      password_confirmation: z.string(),
    })
    .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: t('errors.mismatch') })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: invite.data?.name ?? '', password: '', password_confirmation: '' },
    resetOptions: { keepDirtyValues: true },
  })
  const password = useWatch({ control: form.control, name: 'password' })

  const onSubmit = form.handleSubmit((values) =>
    accept.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', title: t('invite.welcome'), message: t('invite.welcomeBody', { area: invite.data?.area ?? '' }) })
        navigate('/coord', { replace: true })
      },
      onError: (error) => {
        const passwordErrors = errorStatus(error) === 422 ? errorBody(error)?.errors?.password : undefined
        if (passwordErrors?.length) {
          if (passwordErrors.some((m) => isBreachedPasswordMessage(m))) setCommonRejected(true)
          form.setError('password', { message: passwordErrors[0] })
        }
      },
    }),
  )

  if (invite.isPending) {
    return (
      <AuthLayout title={t('invite.title')}>
        <Skeleton className="h-80 w-full rounded-xl" />
      </AuthLayout>
    )
  }

  const gone = invite.isError || (accept.error && [404, 409].includes(errorStatus(accept.error) ?? 0))
  if (gone || !invite.data) {
    return (
      <AuthLayout title={t('invite.expiredTitle')}>
        <IconTile icon="hourglass" tone="neutral" />
        <AuthHeading title={t('invite.expiredTitle')} subtitle={t('invite.expiredBody')} />
        <Button asChild variant="primary" className="w-full">
          <Link to="/login">{t('invite.signIn')}</Link>
        </Button>
      </AuthLayout>
    )
  }

  const unexpected = accept.error && errorStatus(accept.error) !== 422

  return (
    <AuthLayout title={t('invite.title')}>
      <IconTile icon="shield-check" tone="info" />
      <AuthHeading title={t('invite.title')} subtitle={t('invite.subtitle', { area: invite.data.area })} />
      {unexpected && <Banner tone="critical" title={t('errors.generic')} />}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <TextField label={t('fields.email')} type="email" autoComplete="username" value={invite.data.email} readOnly helperText={t('invite.emailHelper')} />
        <TextField label={t('fields.name')} autoComplete="name" error={form.formState.errors.name?.message} {...form.register('name')} />
        <TextField
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          {...form.register('password', { onChange: () => setCommonRejected(false) })}
        />
        <PasswordRequirements id="invite-password-requirements" value={password} commonRejected={commonRejected} />
        <TextField
          label={t('fields.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.password_confirmation?.message}
          {...form.register('password_confirmation')}
        />
        <Button type="submit" variant="primary" className="w-full" loading={accept.isPending}>
          {t('invite.accept')}
        </Button>
      </form>
    </AuthLayout>
  )
}

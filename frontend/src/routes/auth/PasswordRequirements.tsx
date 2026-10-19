import { useTranslation } from 'react-i18next'
import { icons } from '../../components/ui/icons'
import { cn } from '../../lib/cn'
import { meetsPasswordRules, passwordChecks } from './authUtils'

const CheckCircle = icons['check-circle']
const CircleDashed = icons['circle-dashed']
const XCircle = icons['x-circle']

/**
 * Password requirements (23:653), updated as the user types. "Not a commonly
 * used password" is checked by the server (breached-password list), so it
 * only turns red when the API rejects the password.
 */
export function PasswordRequirements({ value, commonRejected = false, id }: { value: string; commonRejected?: boolean; id?: string }) {
  const { t } = useTranslation('auth')
  const rows: Array<{ key: string; label: string; state: 'met' | 'pending' | 'failed' }> = [
    { key: 'length', label: t('requirements.length'), state: passwordChecks.length(value) ? 'met' : 'pending' },
    { key: 'case', label: t('requirements.case'), state: passwordChecks.case(value) ? 'met' : 'pending' },
    { key: 'number', label: t('requirements.number'), state: passwordChecks.number(value) ? 'met' : 'pending' },
    {
      key: 'common',
      label: t('requirements.common'),
      state: commonRejected ? 'failed' : meetsPasswordRules(value) ? 'met' : 'pending',
    },
  ]

  return (
    <ul id={id} aria-label={t('requirements.label')} className="flex flex-col gap-1.5 rounded-md bg-canvas px-3.5 py-3">
      {rows.map((row) => {
        const Icon = row.state === 'met' ? CheckCircle : row.state === 'failed' ? XCircle : CircleDashed
        return (
          <li
            key={row.key}
            className={cn('type-body-s flex items-center gap-2', row.state === 'failed' ? 'text-status-critical' : 'text-primary')}
          >
            <Icon
              aria-hidden
              size={16}
              className={cn(
                'shrink-0',
                row.state === 'met' && 'text-status-success',
                row.state === 'pending' && 'text-tertiary',
              )}
            />
            {row.label}
            <span className="sr-only">· {row.state === 'met' ? t('requirements.met') : t('requirements.notMet')}</span>
          </li>
        )
      })}
    </ul>
  )
}

import type { TFunction } from 'i18next'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { icons, type IconName } from '../../components/ui/icons'
import type { AppNotification } from '../../lib/api/me'
import { cn } from '../../lib/cn'
import { manilaToday } from '../../lib/dates'
import { elapsedSince, formatShortDateTime, formatTime, remainingUntil } from '../../lib/datetime'
import { displayBloodType } from '../../lib/request'

type Tone = 'warning' | 'info' | 'neutral' | 'success' | 'critical'

const TILE: Record<Tone, string> = {
  warning: 'bg-status-warning text-status-warning',
  info: 'bg-status-info text-status-info',
  neutral: 'bg-status-neutral text-status-neutral',
  success: 'bg-status-success text-status-success',
  critical: 'bg-status-critical text-status-critical',
}

/** Kind + current status → icon tile and headline (28:184). */
function look(n: AppNotification): { icon: IconName; tone: Tone; key: string; tail?: 'notActive' | 'noFurther' } {
  if (n.kind === 'expiring_soon') return { icon: 'hourglass', tone: 'warning', key: 'expiring_soon' }
  if (n.kind === 'expired') return { icon: 'hourglass', tone: 'neutral', key: 'expired', tail: 'notActive' }
  if (n.kind === 'approved') return { icon: 'check-circle', tone: 'success', key: 'approved' }
  if (n.kind === 'needs_correction') return { icon: 'pencil', tone: 'warning', key: 'needs_correction' }
  if (n.kind === 'rejected') return { icon: 'x-circle', tone: 'neutral', key: 'rejected' }
  if (n.status === 'fulfilled') return { icon: 'check-circle', tone: 'success', key: 'fulfilled', tail: 'noFurther' }
  if (n.status === 'closed') return { icon: 'lock', tone: 'neutral', key: 'closed', tail: 'noFurther' }
  return { icon: 'refresh', tone: 'info', key: 'status_changed' }
}

/** "Today · 17:00" for today, "35 min ago" under a day, else "Oct 14 · 17:00". */
function when(iso: string, locale: string, t: TFunction<['workspace', 'common', 'explorer']>) {
  const elapsed = elapsedSince(iso)
  if (elapsed.unit === 'justNow' || elapsed.unit === 'minutes' || elapsed.unit === 'hours') {
    return t(`common:time.ago.${elapsed.unit}`, { count: elapsed.count })
  }
  return formatShortDateTime(iso, locale)
}

export function UpdateRow({ notification }: { notification: AppNotification }) {
  const { t, i18n } = useTranslation(['workspace', 'common', 'explorer'])
  const locale = i18n.language
  const { icon, tone, key, tail } = look(notification)
  const Icon = icons[icon]
  const remaining = notification.expires_at ? remainingUntil(notification.expires_at) : null
  const whenText =
    notification.kind === 'expiring_soon' && notification.expires_at
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(notification.expires_at)) === manilaToday()
        ? t('workspace:updates.today', { time: formatTime(notification.expires_at, locale) })
        : formatShortDateTime(notification.expires_at, locale)
      : when(notification.created_at, locale, t)

  const subtitle = [displayBloodType(notification.blood_type), notification.municipality, tail ? t(`workspace:updates.${tail}`) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="border-b border-default last:border-b-0">
      <Link
        to={`/requests?sel=${encodeURIComponent(notification.request_id)}`}
        className={cn('flex items-center gap-3.5 px-5 py-3.5 hover:bg-canvas max-sm:flex-wrap', !notification.read && 'bg-canvas')}
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TILE[tone])}>
          <Icon aria-hidden size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-label-m truncate text-primary">
            {t(`workspace:updates.${key}` as 'workspace:updates.expired', {
              id: notification.request_id,
              when: remaining
                ? t(`explorer:relative.in.${remaining.unit}`, { count: remaining.count })
                : '',
            })}
          </span>
          <span className="type-body-s truncate text-secondary">{subtitle}</span>
        </span>
        <StatusBadge status={notification.status} />
        <span className="type-mono-s shrink-0 text-tertiary">{whenText}</span>
      </Link>
    </li>
  )
}

import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import type { RequestStatus } from '../../lib/request'
import { icons, type IconName } from '../ui/icons'

type Tone = 'neutral' | 'info' | 'warning' | 'critical' | 'success'

/** Single source of truth for status label, icon and tone (5:202). */
const STATUS: Record<RequestStatus, { icon: IconName; tone: Tone }> = {
  draft: { icon: 'circle-dashed', tone: 'neutral' },
  pending_review: { icon: 'clock', tone: 'info' },
  needs_correction: { icon: 'pencil', tone: 'warning' },
  active: { icon: 'circle-dot', tone: 'critical' },
  fulfilled: { icon: 'check-circle', tone: 'success' },
  // Deliberately neutral so they can never read as live.
  closed: { icon: 'lock', tone: 'neutral' },
  expired: { icon: 'hourglass', tone: 'neutral' },
  rejected: { icon: 'ban', tone: 'neutral' },
}

const TONE: Record<Tone, string> = {
  neutral: 'bg-status-neutral text-status-neutral',
  info: 'bg-status-info text-status-info',
  warning: 'bg-status-warning text-status-warning',
  critical: 'bg-status-critical text-status-critical',
  success: 'bg-status-success text-status-success',
}

/** Status Badge: icon + text, never colour alone. */
export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { t } = useTranslation('request')
  const { icon, tone } = STATUS[status]
  const Icon = icons[icon]
  return (
    <span
      className={cn(
        'type-label-s inline-flex shrink-0 items-center gap-1 rounded-sm py-[3px] pr-2 pl-1.5 whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      <Icon aria-hidden size={14} />
      {t(`status.${status}`)}
    </span>
  )
}

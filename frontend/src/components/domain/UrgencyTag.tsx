import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import type { Urgency } from '../../lib/request'
import { icons, type IconName } from '../ui/icons'

const URGENCY: Record<Urgency, { icon: IconName; className: string }> = {
  within_24h: { icon: 'alert-triangle', className: 'border-status-critical text-status-critical' },
  within_72h: { icon: 'clock', className: 'border-status-warning text-status-warning' },
  scheduled: { icon: 'calendar', className: 'border-status-neutral text-status-neutral' },
}

/**
 * Urgency Tag (5:222): the time window stated by the requester — never a
 * medical triage level. Outline style so it never competes with the filled
 * Status Badge.
 */
export function UrgencyTag({ urgency, className }: { urgency: Urgency; className?: string }) {
  const { t } = useTranslation('request')
  const { icon, className: tone } = URGENCY[urgency]
  const Icon = icons[icon]
  return (
    <span
      className={cn(
        'type-label-s inline-flex shrink-0 items-center gap-1 rounded-sm border bg-surface py-0.5 pr-2 pl-1.5 whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon aria-hidden size={14} />
      {t(`urgency.${urgency}`)}
    </span>
  )
}

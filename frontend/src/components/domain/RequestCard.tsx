import { useId, type ComponentPropsWithRef } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { formatShortDate, formatShortDateTime } from '../../lib/datetime'
import type { PublicRequest } from '../../lib/request'
import { icons } from '../ui/icons'
import { BloodTypeTag } from './BloodTypeTag'
import { Freshness } from './Freshness'
import { StatusBadge } from './StatusBadge'
import { UrgencyTag } from './UrgencyTag'

const MapPin = icons['map-pin']
const ShieldCheck = icons['shield-check']
const ChevronRight = icons['chevron-right']

type RequestCardProps = Omit<ComponentPropsWithRef<'a'>, 'href' | 'onSelect'> & {
  request: PublicRequest
  /** Detail route for this request. */
  to: string
  selected?: boolean
  /** Hover AND keyboard focus — synced with the map marker (55:212). */
  onHighlight?: (id: string | null) => void
  onSelect?: (id: string) => void
  now?: Date
}

/**
 * Request Card (9:487). Shows only public, non-sensitive fields. Expired and
 * closed are visually receded — never presented as active. The whole card is
 * one link labelled by ID + type + city.
 */
export function RequestCard({
  request,
  to,
  selected = false,
  onHighlight,
  onSelect,
  now,
  className,
  ...props
}: RequestCardProps) {
  const { t, i18n } = useTranslation('request')
  const labelId = useId()
  const { status } = request
  const expired = status === 'expired'
  const closed = status === 'closed'
  const receded = expired || closed
  const locale = i18n.language

  const summary = expired ? t('card.expiredSummary') : closed ? t('card.closedSummary') : request.public_summary

  const freshnessLabel = closed
    ? t('card.closedOn', { date: formatShortDate(request.updated_at, locale) })
    : expired
      ? t('card.lastUpdated', { date: formatShortDate(request.updated_at, locale) })
      : undefined

  return (
    <Link
      to={to}
      aria-labelledby={`${labelId}-id ${labelId}-type ${labelId}-city`}
      aria-current={selected ? 'true' : undefined}
      onMouseEnter={() => onHighlight?.(request.id)}
      onMouseLeave={() => onHighlight?.(null)}
      onFocus={() => onHighlight?.(request.id)}
      onBlur={() => onHighlight?.(null)}
      onClick={() => onSelect?.(request.id)}
      className={cn(
        'group flex w-full flex-col gap-3 rounded-lg text-left transition-[border-color,box-shadow] duration-150',
        receded
          ? 'border border-default bg-canvas p-4'
          : selected
            ? 'border-2 border-brand bg-surface p-[15px] shadow-floating'
            : 'border border-default bg-surface p-4 hover:border-strong hover:shadow-raised',
        className,
      )}
      {...props}
    >
      <div className="flex w-full items-start gap-3">
        <span id={`${labelId}-type`}>
          <BloodTypeTag type={request.blood_type} dimmed={receded} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span id={`${labelId}-id`} className="type-mono-m text-secondary">
              {request.id}
            </span>
            <StatusBadge status={status} />
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <MapPin aria-hidden size={14} className="shrink-0 text-secondary" />
            <span
              id={`${labelId}-city`}
              className={cn('type-label-m truncate', receded ? 'text-secondary' : 'text-primary')}
            >
              {request.location.municipality}
            </span>
            <span className="type-body-s shrink-0 text-tertiary">· {request.location.province}</span>
          </div>
        </div>
      </div>

      <p className={cn('type-body-s', receded ? 'text-tertiary' : 'text-secondary')}>{summary}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!receded && <UrgencyTag urgency={request.urgency} />}
        <Freshness updatedAt={request.updated_at} label={freshnessLabel} level={receded ? 'stale' : undefined} now={now} tooltip={false} />
        {!closed && request.expires_at && (
          <span className={cn('type-mono-s inline-flex items-center gap-1', expired ? 'text-tertiary' : 'text-secondary')}>
            <icons.hourglass aria-hidden size={14} className="shrink-0" />
            {t(expired ? 'card.expired' : 'card.expires', { when: formatShortDateTime(request.expires_at, locale) })}
          </span>
        )}
      </div>

      <span aria-hidden className="h-px w-full bg-[var(--border-default)]" />

      <div className="flex items-center justify-between gap-2">
        <span className="type-body-s inline-flex items-center gap-1 text-tertiary">
          <ShieldCheck aria-hidden size={14} className="shrink-0" />
          {receded ? t('card.notAccepting') : t('card.reviewed')}
        </span>
        <span
          aria-hidden
          className={cn('type-label-m inline-flex items-center gap-0.5', receded ? 'text-secondary' : 'text-link')}
        >
          {t('card.viewDetails')}
          <ChevronRight size={16} />
        </span>
      </div>
    </Link>
  )
}

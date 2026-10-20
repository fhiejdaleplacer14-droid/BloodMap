import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { displayBloodType, type BloodType } from '../../lib/request'

type BloodTypeTagProps = {
  type: BloodType
  /** lg 52×52 = cards & detail headers · sm 44×24 = tables, chips, map callouts. */
  size?: 'lg' | 'sm'
  /** Receded (expired / closed) requests show a neutral tag — never brand red. */
  dimmed?: boolean
  className?: string
}

/** Blood Type Tag (5:264): always text; screen readers hear "O negative". */
export function BloodTypeTag({ type, size = 'lg', dimmed, className }: BloodTypeTagProps) {
  const { t } = useTranslation('request')
  const visible = displayBloodType(type)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 flex-col items-center justify-center border font-semibold',
        size === 'lg' ? 'size-13 rounded-md' : 'h-6 w-11 rounded-sm',
        // Receded requests use neutral colours, not opacity, so text keeps 4.5:1 (decision #87).
        dimmed ? 'border-default bg-subtle text-secondary' : 'border-brand-soft bg-brand-soft text-brand',
        className,
      )}
    >
      <span aria-hidden className="contents">
        {size === 'lg' ? (
          <>
            <span className="text-[9px] leading-3 tracking-[0.08em] uppercase">{t('bloodType.label')}</span>
            <span className="text-xl/7 tracking-[-0.02em]">{visible}</span>
          </>
        ) : (
          <span className="text-sm/5">{visible}</span>
        )}
      </span>
      <span className="sr-only">{t(`bloodType.spoken.${type}`)}</span>
    </span>
  )
}

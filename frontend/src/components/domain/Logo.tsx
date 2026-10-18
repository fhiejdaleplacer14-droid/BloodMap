import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import markUrl from '../../assets/brand/mark.svg'
import markMonoUrl from '../../assets/brand/mark-mono.svg'
import markTileUrl from '../../assets/brand/mark-tile.svg'

type LogoProps = {
  /** horizontal lockup · mark only · app-icon tile */
  variant?: 'horizontal' | 'mark' | 'tile'
  /**
   * default follows the theme (text/primary) · inverse sits on bg/inverse ·
   * mono is the single-colour lockup.
   */
  tone?: 'default' | 'inverse' | 'mono'
  /** md = 20 px wordmark (desktop) · sm = 17 px (Mobile Top Bar). */
  size?: 'md' | 'sm'
  className?: string
}

/**
 * Logo (10:383). Mark: a map pin holding a blood drop. "NIR" is set in
 * JetBrains Mono as a region code. No cross symbols — implies no official
 * affiliation. Min size: mark 16 px, lockup 120 px wide.
 */
export function Logo({ variant = 'horizontal', tone = 'default', size = 'md', className }: LogoProps) {
  const { t } = useTranslation()
  const name = t('appName')

  if (variant === 'tile') {
    return (
      <span role="img" aria-label={name} className={cn('inline-flex size-12 items-center justify-center rounded-lg bg-brand', className)}>
        <img src={markTileUrl} alt="" width={22.75} height={28} />
      </span>
    )
  }

  const mark = (
    <img
      src={tone === 'mono' ? markMonoUrl : markUrl}
      alt=""
      width={size === 'md' ? 26 : 22.1}
      height={size === 'md' ? 32 : 27.2}
      className="shrink-0"
    />
  )

  if (variant === 'mark') {
    return (
      <span role="img" aria-label={name} className={cn('inline-flex', className)}>
        {mark}
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={cn('inline-flex items-center', size === 'md' ? 'gap-2.5' : 'gap-[8.5px]', className)}
    >
      {mark}
      <span aria-hidden className={cn('inline-flex items-center', size === 'md' ? 'gap-2' : 'gap-[6.8px]')}>
        <span
          className={cn(
            'font-sans font-semibold tracking-[-0.03em] whitespace-nowrap',
            size === 'md' ? 'text-xl leading-7' : 'text-[17px] leading-[23.8px]',
            tone === 'inverse' ? 'text-on-inverse' : 'text-primary',
          )}
        >
          BloodMap
        </span>
        <span
          className={cn(
            'rounded-xs border font-mono font-medium tracking-[0.06em]',
            size === 'md' ? 'px-[5px] py-px text-xs leading-4' : 'px-[4.25px] py-[0.85px] text-[10.2px] leading-[13.6px]',
            tone === 'default' && 'border-brand-soft text-brand',
            tone === 'inverse' && 'border-strong text-on-inverse',
            tone === 'mono' && 'border-strong text-primary',
          )}
        >
          NIR
        </span>
      </span>
    </span>
  )
}

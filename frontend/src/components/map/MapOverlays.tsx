import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { icons, type IconName } from '../ui/icons'
import { Tooltip } from '../ui/Tooltip'

/** Map controls (14:512): zoom in · zoom out · use my location · map layers. */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  onToggleKey,
  keyOpen,
  canZoomIn,
  canZoomOut,
  className,
}: {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
  onToggleKey: () => void
  keyOpen: boolean
  canZoomIn: boolean
  canZoomOut: boolean
  className?: string
}) {
  const { t } = useTranslation('explorer')
  const button = (icon: IconName, label: string, onClick: () => void, extra?: { pressed?: boolean; disabled?: boolean }) => (
    <Tooltip content={label} side="left">
      <button
        type="button"
        aria-label={label}
        aria-pressed={extra?.pressed}
        disabled={extra?.disabled}
        onClick={onClick}
        className={cn(
          'flex size-10 items-center justify-center text-primary transition-colors duration-150 hover:bg-subtle max-lg:size-11',
          'disabled:cursor-not-allowed disabled:text-tertiary disabled:hover:bg-transparent',
          extra?.pressed && 'bg-subtle',
        )}
      >
        {(() => {
          const Icon = icons[icon]
          return <Icon aria-hidden size={18} />
        })()}
      </button>
    </Tooltip>
  )

  return (
    <div
      className={cn(
        'flex flex-col divide-y divide-line overflow-hidden rounded-md border border-default bg-surface shadow-raised',
        className,
      )}
    >
      {button('plus', t('map.zoomIn'), onZoomIn, { disabled: !canZoomIn })}
      {button('minus', t('map.zoomOut'), onZoomOut, { disabled: !canZoomOut })}
      {button('locate', t('map.locate'), onLocate)}
      {button('layers', t('map.layers'), onToggleKey, { pressed: keyOpen })}
    </div>
  )
}

/** Floating chip over the map (loading, none in view, not shown …). */
export function MapChip({ icon, spin, children, className }: { icon?: IconName; spin?: boolean; children: ReactNode; className?: string }) {
  const Icon = icon ? icons[icon] : null
  return (
    <div
      className={cn(
        'type-label-m inline-flex items-center gap-2 rounded-md border border-default bg-surface px-3 py-2 text-secondary shadow-floating',
        className,
      )}
    >
      {Icon && <Icon aria-hidden size={16} className={cn('shrink-0', spin && 'animate-spin')} />}
      {children}
    </div>
  )
}

/** Demo label (14:532 "Demonstration map · fictional requests", 20:3593 "Sample data"). */
export function DemoBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'type-label-s inline-flex items-center gap-1 rounded-sm bg-status-info py-0.75 pr-2 pl-1.5 text-status-info',
        className,
      )}
    >
      <icons.info aria-hidden size={14} className="shrink-0" />
      {children}
    </span>
  )
}

/** Map key (14:547). */
export function MapKey({ className }: { className?: string }) {
  const { t } = useTranslation('explorer')
  return (
    <section
      aria-label={t('map.key.title')}
      className={cn('flex flex-col gap-2 rounded-lg border border-default bg-surface px-3.5 py-3 shadow-raised', className)}
    >
      <h2 className="type-overline text-tertiary">{t('map.key.title')}</h2>
      <ul className="flex flex-col gap-2">
        <li className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-7 w-9 items-center justify-center">
            <span className="rounded-[6px] border-[1.6px] border-brand bg-surface px-1.5 py-0.5 text-[11px]/4 font-semibold text-brand">
              O+
            </span>
          </span>
          <span className="type-body-s text-secondary">{t('map.key.request')}</span>
        </li>
        <li className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-7 w-9 items-center justify-center">
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-(--bg-surface) bg-inverse text-[9px] font-semibold text-on-inverse">
              8
            </span>
          </span>
          <span className="type-body-s text-secondary">{t('map.key.cluster')}</span>
        </li>
        <li className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-7 w-9 items-center justify-center">
            <span className="flex size-6 items-center justify-center rounded-[6px] border-[1.5px] border-(--bg-inverse) bg-surface text-primary">
              <icons.building size={12} />
            </span>
          </span>
          <span className="type-body-s text-secondary">{t('map.key.facility')}</span>
        </li>
        <li className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-7 w-9 items-center justify-center">
            <span className="size-6 rounded-full border-[1.5px] border-dashed border-brand bg-brand-soft" />
          </span>
          <span className="type-body-s text-secondary">{t('map.key.area')}</span>
        </li>
      </ul>
    </section>
  )
}

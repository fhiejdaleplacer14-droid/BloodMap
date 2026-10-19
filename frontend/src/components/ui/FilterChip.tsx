import type { ComponentPropsWithRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { icons } from './icons'

type FilterChipProps = Omit<ComponentPropsWithRef<'button'>, 'children' | 'onClick'> & {
  label: string
  /** Toggle chip inside the filter panel (aria-pressed). */
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  /**
   * Applied chip above results: renders as a button that removes the filter
   * ("Remove filter: Type O+").
   */
  onRemove?: () => void
  /** Accessible description of the filter for the remove label, e.g. "Type O+". */
  removeLabel?: string
}

/** Filter Chip (5:281): 34 high (32 + border), radius 8. */
export function FilterChip({
  label,
  pressed,
  onPressedChange,
  onRemove,
  removeLabel,
  className,
  ...props
}: FilterChipProps) {
  const { t } = useTranslation()
  const applied = Boolean(onRemove)
  const selected = applied || pressed

  return (
    <button
      type="button"
      aria-pressed={applied ? undefined : Boolean(pressed)}
      aria-label={applied ? t('filter.remove', { label: removeLabel ?? label }) : undefined}
      onClick={() => (applied ? onRemove?.() : onPressedChange?.(!pressed))}
      className={cn(
        'type-label-m inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-md border px-3 transition-colors duration-150',
        selected
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-default bg-surface text-primary hover:bg-subtle',
        pressed && !applied && 'pl-2',
        className,
      )}
      {...props}
    >
      {pressed && !applied && <icons.check aria-hidden size={16} />}
      {label}
      {applied && <icons.x aria-hidden size={14} />}
    </button>
  )
}

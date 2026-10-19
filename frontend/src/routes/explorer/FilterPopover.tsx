import type { ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { icons } from '../../components/ui/icons'
import { cn } from '../../lib/cn'

const ChevronDown = icons['chevron-down']

type FilterPopoverProps = {
  /** Trigger text, e.g. "Blood type". */
  label: string
  /** "· 2", "· Active" — shown when the filter is applied (14:69). */
  value?: string
  active: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  hint?: string
  children: ReactNode
  onReset: () => void
  onApply: () => void
  applyLabel: string
  applyDisabled?: boolean
  applyLoading?: boolean
}

/**
 * Filter trigger + popover (19:2947, 19:3128): 320 w, radius 12,
 * Elevation/3. Choices are a draft until Apply; Esc / outside click discards.
 */
export function FilterPopover({
  label,
  value,
  active,
  open,
  onOpenChange,
  title,
  hint,
  children,
  onReset,
  onApply,
  applyLabel,
  applyDisabled,
  applyLoading,
}: FilterPopoverProps) {
  const { t } = useTranslation('explorer')
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        className={cn(
          'type-label-m inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-md border pr-2.5 pl-3 transition-colors duration-150 max-lg:min-h-11',
          active ? 'border-brand bg-brand-soft text-brand' : 'border-default bg-surface text-primary hover:bg-subtle',
        )}
      >
        {label}
        {active && value && <span>{value}</span>}
        <ChevronDown aria-hidden size={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label={title}
          className="z-40 flex w-80 max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-default bg-surface shadow-overlay"
        >
          <div className="flex flex-col gap-0.5 px-4 pt-4 pb-1">
            <p className="type-label-m text-primary">{title}</p>
            {hint && <p className="type-body-s text-secondary">{hint}</p>}
          </div>
          <div className="px-4 pt-2 pb-4">{children}</div>
          <div className="flex items-center justify-between border-t border-default px-4 py-3">
            <Button variant="tertiary" onClick={onReset}>
              {t('filters.reset')}
            </Button>
            <Button variant="primary" onClick={onApply} disabled={applyDisabled} loading={applyLoading}>
              {applyLabel}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

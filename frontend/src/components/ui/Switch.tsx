import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { Switch as RadixSwitch } from 'radix-ui'
import { cn } from '../../lib/cn'

type SwitchProps = Omit<ComponentPropsWithRef<typeof RadixSwitch.Root>, 'children'> & {
  label: ReactNode
}

/**
 * Switch (6:459) — instantly-applied preferences only (role="switch").
 * Use Checkbox inside forms that need a Save.
 * Track 36×20: off = border/strong, on = bg/inverse, disabled = bg/subtle.
 */
export function Switch({ label, id, className, disabled, ...props }: SwitchProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className={cn('flex items-center gap-3 max-lg:min-h-11', className)}>
      <RadixSwitch.Root
        id={inputId}
        disabled={disabled}
        className={cn(
          'group relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-(--border-strong) transition-colors duration-150',
          'data-[state=checked]:bg-inverse disabled:cursor-not-allowed disabled:bg-subtle disabled:data-[state=checked]:bg-subtle',
        )}
        {...props}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block size-4 translate-x-0.5 rounded-full bg-surface transition-transform duration-150',
            'data-[state=checked]:translate-x-4.5 data-[state=checked]:bg-(--text-on-inverse)',
            'group-disabled:bg-surface group-disabled:data-[state=checked]:bg-surface',
          )}
        />
      </RadixSwitch.Root>
      <label
        htmlFor={inputId}
        className={cn('type-body-m', disabled ? 'cursor-not-allowed text-tertiary' : 'cursor-pointer text-primary')}
      >
        {label}
      </label>
    </div>
  )
}

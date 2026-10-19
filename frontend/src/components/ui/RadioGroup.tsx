import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { RadioGroup as RadixRadioGroup } from 'radix-ui'
import { cn } from '../../lib/cn'

type RadioOption = { value: string; label: ReactNode; disabled?: boolean }

type RadioGroupProps = Omit<ComponentPropsWithRef<typeof RadixRadioGroup.Root>, 'children'> & {
  options: RadioOption[]
  /** Accessible name for the group (visible legend or aria-label). */
  label: string
}

/** Radio (6:433): 20 px ring; selected = 6 px ink border. Arrow keys move. */
export function RadioGroup({ options, label, className, ...props }: RadioGroupProps) {
  const baseId = useId()
  return (
    <RadixRadioGroup.Root aria-label={label} className={cn('flex flex-col gap-2', className)} {...props}>
      {options.map((option) => {
        const itemId = `${baseId}-${option.value}`
        const disabled = option.disabled || props.disabled
        return (
          <div key={option.value} className="flex items-center gap-2 max-lg:min-h-11">
            <RadixRadioGroup.Item
              id={itemId}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                'size-5 shrink-0 rounded-full border border-strong bg-surface',
                'data-[state=checked]:border-[6px] data-[state=checked]:border-(--text-primary)',
                'disabled:cursor-not-allowed disabled:border-default disabled:bg-subtle',
                'disabled:data-[state=checked]:border-(--text-primary)',
              )}
            />
            <label
              htmlFor={itemId}
              className={cn('type-body-m', disabled ? 'cursor-not-allowed text-tertiary' : 'cursor-pointer text-primary')}
            >
              {option.label}
            </label>
          </div>
        )
      })}
    </RadixRadioGroup.Root>
  )
}

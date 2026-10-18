import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { Checkbox as RadixCheckbox } from 'radix-ui'
import { cn } from '../../lib/cn'
import { icons } from './icons'

type CheckboxProps = Omit<ComponentPropsWithRef<typeof RadixCheckbox.Root>, 'children'> & {
  label: ReactNode
}

/**
 * Checkbox (6:433). 20 px control; the whole label is clickable (44 px hit
 * area on touch). Checked uses ink, never brand red. checked="indeterminate"
 * renders Mixed (aria-checked="mixed").
 */
export function Checkbox({ label, id, className, disabled, ...props }: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className={cn('flex items-center gap-2 max-lg:min-h-11', className)}>
      <RadixCheckbox.Root
        id={inputId}
        disabled={disabled}
        className={cn(
          'group inline-flex size-5 shrink-0 items-center justify-center rounded-xs border border-strong bg-surface text-on-inverse',
          'data-[state=checked]:border-[var(--bg-inverse)] data-[state=checked]:bg-inverse',
          'data-[state=indeterminate]:border-[var(--bg-inverse)] data-[state=indeterminate]:bg-inverse',
          'disabled:cursor-not-allowed disabled:border-default disabled:bg-subtle disabled:text-tertiary',
          'disabled:data-[state=checked]:border-default disabled:data-[state=checked]:bg-subtle',
          'disabled:data-[state=indeterminate]:border-default disabled:data-[state=indeterminate]:bg-subtle',
        )}
        {...props}
      >
        <RadixCheckbox.Indicator>
          <icons.check aria-hidden size={14} className="group-data-[state=indeterminate]:hidden" />
          <icons.minus aria-hidden size={14} className="hidden group-data-[state=indeterminate]:block" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label
        htmlFor={inputId}
        className={cn('type-body-m', disabled ? 'cursor-not-allowed text-tertiary' : 'cursor-pointer text-primary')}
      >
        {label}
      </label>
    </div>
  )
}

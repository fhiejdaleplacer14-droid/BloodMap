import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Field } from './Field'
import { controlClassName, controlInputClassName } from './fieldStyles'
import { icons } from './icons'

const ChevronDown = icons['chevron-down']

type SelectFieldProps = ComponentPropsWithRef<'select'> & {
  label: ReactNode
  helperText?: ReactNode
  error?: ReactNode
  /** Shown as the empty first option ("Any blood type"). */
  placeholder?: string
}

/** Select Field (6:374): native <select> so mobile pickers stay native. */
export function SelectField({
  label,
  helperText,
  error,
  disabled,
  id,
  className,
  placeholder,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <Field label={label} helperText={helperText} error={error} disabled={disabled} id={id} className={className}>
      {({ inputId, describedBy, invalid }) => (
        <div className={controlClassName({ invalid, disabled })}>
          <select
            id={inputId}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              controlInputClassName,
              'type-body-m h-full cursor-pointer pr-7 text-primary [&:has(option[value=""]:checked)]:text-tertiary',
            )}
            {...props}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {children}
          </select>
          <ChevronDown
            aria-hidden
            size={18}
            className="pointer-events-none absolute right-3 shrink-0 text-secondary"
          />
        </div>
      )}
    </Field>
  )
}

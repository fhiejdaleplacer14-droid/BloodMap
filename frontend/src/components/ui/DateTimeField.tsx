import { useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Field } from './Field'
import { controlClassName, controlInputClassName } from './fieldStyles'
import { icons } from './icons'

type DateTimeFieldProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  label: ReactNode
  helperText?: ReactNode
  error?: ReactNode
}

/**
 * Native <input type="date|time"> styled like Text Field (6:374). The
 * browser's picker indicator is stretched invisibly over the trailing icon,
 * so clicking the icon opens the native picker. Filled values use Mono/M.
 */
function NativePickerField({
  kind,
  label,
  helperText,
  error,
  disabled,
  id,
  className,
  ref,
  onChange,
  ...props
}: DateTimeFieldProps & { kind: 'date' | 'time' }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [filledState, setFilled] = useState(Boolean(props.defaultValue))
  const filled = props.value !== undefined ? Boolean(props.value) : filledState
  const Icon = kind === 'date' ? icons.calendar : icons.clock

  return (
    <Field label={label} helperText={helperText} error={error} disabled={disabled} id={id} className={className}>
      {({ inputId, describedBy, invalid }) => (
        <div className={controlClassName({ invalid, disabled })}>
          <input
            ref={(node) => {
              inputRef.current = node
              if (typeof ref === 'function') ref(node)
              else if (ref) ref.current = node
            }}
            id={inputId}
            type={kind}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              setFilled(event.target.value !== '')
              onChange?.(event)
            }}
            className={cn(controlInputClassName, 'native-picker h-full', filled ? 'type-mono-m text-primary' : 'type-body-m text-tertiary')}
            {...props}
          />
          <Icon aria-hidden size={18} className="pointer-events-none absolute right-3 shrink-0 text-secondary" />
        </div>
      )}
    </Field>
  )
}

/** Date Field — stored UTC, shown as a date in Asia/Manila. */
export function DateField(props: DateTimeFieldProps) {
  return <NativePickerField kind="date" {...props} />
}

/** Time Field — times shown in Asia/Manila (PHT). */
export function TimeField(props: DateTimeFieldProps) {
  return <NativePickerField kind="time" {...props} />
}

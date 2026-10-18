import { useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Field } from './Field'
import { controlClassName, controlInputClassName } from './fieldStyles'
import { icons } from './icons'

const EyeOff = icons['eye-off']

type TextFieldProps =Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  label: ReactNode
  /** text (incl. email/tel via inputMode) · password · search */
  type?: 'text' | 'email' | 'password' | 'search' | 'tel'
  helperText?: ReactNode
  /** Zod / server message — switches the field to its Error state. */
  error?: ReactNode
  /** Search only: called when the clear (×) button is pressed. */
  onClear?: () => void
}

/**
 * Text Field (6:220). Works as an uncontrolled input so React Hook Form's
 * register() can be spread onto it; also works controlled.
 * Password: eye toggle (aria-pressed); paste and managers allowed (3.3.8).
 * Search: leading search icon; clear (×) appears once filled.
 */
export function TextField({
  label,
  type = 'text',
  helperText,
  error,
  disabled,
  id,
  className,
  onClear,
  onChange,
  ref,
  ...props
}: TextFieldProps) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const [filled, setFilled] = useState(Boolean(props.value ?? props.defaultValue))
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isPassword = type === 'password'
  const isSearch = type === 'search'
  const showClear = isSearch && !disabled && (props.value !== undefined ? Boolean(props.value) : filled)

  return (
    <Field label={label} helperText={helperText} error={error} disabled={disabled} id={id} className={className}>
      {({ inputId, describedBy, invalid }) => (
        <div className={controlClassName({ invalid, disabled })}>
          {isSearch && <icons.search aria-hidden size={18} className="shrink-0 text-secondary" />}
          <input
            ref={(node) => {
              inputRef.current = node
              if (typeof ref === 'function') ref(node)
              else if (ref) ref.current = node
            }}
            id={inputId}
            type={isPassword ? (revealed ? 'text' : 'password') : type}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              setFilled(event.target.value !== '')
              onChange?.(event)
            }}
            className={cn(controlInputClassName, 'type-body-m text-primary', isSearch && '[&::-webkit-search-cancel-button]:hidden')}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              aria-label={t('field.showPassword')}
              aria-pressed={revealed}
              disabled={disabled}
              onClick={() => setRevealed((value) => !value)}
              className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-secondary disabled:text-tertiary"
            >
              {revealed ? <EyeOff aria-hidden size={18} /> : <icons.eye aria-hidden size={18} />}
            </button>
          )}
          {showClear && (
            <button
              type="button"
              aria-label={t('field.clearSearch')}
              onClick={() => {
                if (inputRef.current && props.value === undefined) inputRef.current.value = ''
                setFilled(false)
                onClear?.()
                inputRef.current?.focus()
              }}
              className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-secondary"
            >
              <icons.x aria-hidden size={18} />
            </button>
          )}
        </div>
      )}
    </Field>
  )
}

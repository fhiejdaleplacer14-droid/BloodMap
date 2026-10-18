import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { icons } from './icons'

const AlertCircle = icons['alert-circle']

export type FieldState = {
  inputId: string
  describedBy: string | undefined
  invalid: boolean
}

type FieldProps = {
  label: ReactNode
  helperText?: ReactNode
  error?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  children: (state: FieldState) => ReactNode
}

/**
 * Shared shell for Text / Select / Date / Time fields (6:220, 6:374).
 * Label is always visible (no placeholder-as-label). Error replaces the
 * helper with an icon + message linked via aria-describedby.
 */
export function Field({ label, helperText, error, disabled, id, className, children }: FieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`
  const hasMessage = Boolean(error || helperText)

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={cn('type-label-m', disabled ? 'text-tertiary' : 'text-primary')}>
        {label}
      </label>
      {children({ inputId, describedBy: hasMessage ? messageId : undefined, invalid: Boolean(error) })}
      {error ? (
        <p id={messageId} className="type-body-s flex gap-1 text-status-critical">
          <AlertCircle aria-hidden size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        helperText && (
          <p id={messageId} className="type-body-s text-secondary">
            {helperText}
          </p>
        )
      )}
    </div>
  )
}

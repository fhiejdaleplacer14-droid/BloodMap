import { useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Field } from './Field'

type TextAreaFieldProps = ComponentPropsWithRef<'textarea'> & {
  label: ReactNode
  helperText?: ReactNode
  error?: ReactNode
  /** Shows "108 / 280" beside the helper; the limit itself is enforced by validation. */
  maxChars?: number
  /** Current length when the value is set from outside (RHF reset / useWatch). */
  charCount?: number
}

/**
 * Multi-line Text Field (31:300): same box as Text Field, 72 px min height,
 * with a live character count in mono. Works with RHF register().
 */
export function TextAreaField({
  label,
  helperText,
  error,
  maxChars,
  charCount,
  disabled,
  id,
  className,
  onChange,
  ...props
}: TextAreaFieldProps) {
  const { t } = useTranslation('manage')
  const [length, setLength] = useState(String(props.value ?? props.defaultValue ?? '').length)
  const count = charCount ?? (props.value !== undefined ? String(props.value).length : length)
  const over = maxChars !== undefined && count > maxChars

  const helper =
    maxChars === undefined ? (
      helperText
    ) : (
      <span className="flex items-start justify-between gap-3">
        <span>{helperText}</span>
        <span className={cn('type-mono-s shrink-0', over ? 'text-status-critical' : 'text-tertiary')}>
          {t('fields.count', { count, max: maxChars })}
        </span>
      </span>
    )

  return (
    <Field label={label} helperText={helper} error={error} disabled={disabled} id={id} className={className}>
      {({ inputId, describedBy, invalid }) => (
        <textarea
          id={inputId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setLength(event.target.value.length)
            onChange?.(event)
          }}
          className={cn(
            'type-body-m min-h-18 w-full resize-y rounded-md bg-surface px-3 py-2 text-primary outline-none placeholder:text-tertiary',
            disabled
              ? 'border border-default bg-subtle text-tertiary'
              : invalid
                ? 'border-2 border-status-critical px-2.75 py-1.75'
                : 'border border-default hover:border-strong focus:border-2 focus:border-focus focus:px-2.75 focus:py-1.75 focus:shadow-focus',
          )}
          {...props}
        />
      )}
    </Field>
  )
}

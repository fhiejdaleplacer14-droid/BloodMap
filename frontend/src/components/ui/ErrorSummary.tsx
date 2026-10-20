import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { icons } from './icons'

const AlertCircle = icons['alert-circle']

export type SummaryError = { name: string; label: string; message: string }

/**
 * Error summary (Handoff 55:439, WCAG 3.3.1/3.3.3): after a failed submit,
 * the problems are listed at the top, each one moving focus to its field.
 * Takes focus itself when it first appears so screen readers hear it.
 */
export function ErrorSummary({ errors, onSelect }: { errors: SummaryError[]; onSelect: (name: string) => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const shown = errors.length > 0

  useEffect(() => {
    if (shown) ref.current?.focus()
  }, [shown])

  if (!shown) return null
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="flex flex-col gap-2 rounded-lg border border-(--status-critical-fg) bg-status-critical px-4 py-3 text-status-critical outline-none focus-visible:shadow-focus"
    >
      <p id="error-summary-title" className="type-label-m flex items-center gap-2">
        <AlertCircle aria-hidden size={16} />
        {t('errorSummary.title', { count: errors.length })}
      </p>
      <ul className="flex flex-col gap-1 pl-6">
        {errors.map((error) => (
          <li key={error.name}>
            <button type="button" onClick={() => onSelect(error.name)} className="type-body-s text-left underline underline-offset-2">
              {error.label}: {error.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

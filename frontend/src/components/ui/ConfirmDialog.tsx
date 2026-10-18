import { useState, type ReactNode } from 'react'
import { AlertDialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Button, type ButtonVariant } from './Button'
import { icons, type IconName } from './icons'
import { TextField } from './TextField'

type Tone = 'critical' | 'warning' | 'success'

const TONE_TILE: Record<Tone, string> = {
  critical: 'bg-status-critical text-status-critical',
  warning: 'bg-status-warning text-status-warning',
  success: 'bg-status-success text-status-success',
}

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tone: Tone
  icon: IconName
  /** Destructive confirms restate the object ID (e.g. "Close request BM-2026-0012?"). */
  title: ReactNode
  description: ReactNode
  confirmLabel: string
  confirmVariant?: ButtonVariant
  confirmIcon?: IconName
  /** Reason fields are required for reject/correction and stored in the audit log. */
  requireReason?: { label: string; placeholder?: string; helperText?: string; requiredMessage: string }
  onConfirm: (reason?: string) => void
  loading?: boolean
}

/**
 * Modal Dialog (10:464): 480 w, radius 16, Elevation/3 over a 48 % ink scrim.
 * Focus is trapped; Esc and ✕ cancel; initial focus on Cancel.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  tone,
  icon,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  confirmIcon,
  requireReason,
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string>()
  const Icon = icons[icon]

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('')
      setReasonError(undefined)
    }
    onOpenChange(next)
  }

  const confirm = () => {
    if (requireReason && reason.trim() === '') {
      setReasonError(requireReason.requiredMessage)
      return
    }
    onConfirm(requireReason ? reason.trim() : undefined)
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-overlay/48" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-surface p-6 shadow-overlay">
          <div className="flex items-start gap-3">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', TONE_TILE[tone])}>
              <Icon aria-hidden size={20} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <AlertDialog.Title className="type-h3 text-primary">{title}</AlertDialog.Title>
              <AlertDialog.Description className="type-body-m text-secondary">{description}</AlertDialog.Description>
            </div>
            <AlertDialog.Cancel aria-label={t('actions.close')} className="shrink-0 rounded-sm text-secondary">
              <icons.x aria-hidden size={20} />
            </AlertDialog.Cancel>
          </div>

          {requireReason && (
            <TextField
              label={requireReason.label}
              placeholder={requireReason.placeholder}
              helperText={requireReason.helperText}
              error={reasonError}
              value={reason}
              required
              aria-required
              onChange={(event) => {
                setReason(event.target.value)
                if (reasonError) setReasonError(undefined)
              }}
            />
          )}

          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{t('actions.cancel')}</Button>
            </AlertDialog.Cancel>
            {/* Not AlertDialog.Action: it would close before validation and the request finish. */}
            <Button variant={confirmVariant} icon={confirmIcon} loading={loading} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

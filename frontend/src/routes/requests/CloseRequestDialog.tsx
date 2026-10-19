import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import type { ManagedRequest } from '../../lib/api/myRequests'

/**
 * Confirm close (32:1342 · 32:1755). The frame has no reason field, but the
 * API keeps one for the history (Handoff, 51:476) — decision #40.
 */
export function CloseRequestDialog({
  request,
  loading,
  onCancel,
  onConfirm,
}: {
  request: ManagedRequest | null
  loading: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const { t } = useTranslation('manage')
  return (
    <ConfirmDialog
      open={request !== null}
      onOpenChange={(open) => !open && onCancel()}
      tone="critical"
      icon="trash"
      title={t('actions.closeTitle', { id: request?.id ?? '' })}
      description={t('actions.closeBody')}
      confirmLabel={t('actions.close')}
      confirmVariant="destructive"
      confirmIcon="trash"
      requireReason={{
        label: t('actions.closeReason'),
        helperText: t('actions.closeReasonHelp'),
        requiredMessage: t('actions.closeReasonRequired'),
        minLength: 3,
      }}
      loading={loading}
      onConfirm={(reason) => reason && onConfirm(reason)}
    />
  )
}

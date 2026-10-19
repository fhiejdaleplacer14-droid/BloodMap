import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '../../components/ui/toast'
import { useCloseRequest, useExtendRequest, useFulfillRequest, type ManagedRequest } from '../../lib/api/myRequests'
import { formatShortDateTime } from '../../lib/datetime'

/**
 * Owner actions shared by My Requests and the owner detail (32:959 · 32:1815).
 * Buttons only render when the API's `can` flags allow them; the server
 * still decides. Close goes through <CloseRequestDialog {...closeDialog} />.
 */
export function useOwnerActions() {
  const { t, i18n } = useTranslation('manage')
  const [closing, setClosing] = useState<ManagedRequest | null>(null)
  const extend = useExtendRequest()
  const fulfill = useFulfillRequest()
  const close = useCloseRequest()
  const failed = () => toast({ tone: 'error', title: t('actions.failed'), message: t('actions.failedBody') })

  const run = {
    extend: (request: ManagedRequest) =>
      extend.mutate(request.id, {
        onSuccess: (updated) =>
          toast({
            tone: 'success',
            title: t('actions.extended'),
            message: t('actions.extendedBody', {
              id: updated.id,
              when: updated.expires_at ? formatShortDateTime(updated.expires_at, i18n.language) : '',
            }),
          }),
        onError: failed,
      }),
    fulfill: (request: ManagedRequest) =>
      fulfill.mutate(request.id, {
        onSuccess: (updated) => toast({ tone: 'success', title: t('actions.fulfilled'), message: t('actions.fulfilledBody', { id: updated.id }) }),
        onError: failed,
      }),
    close: (request: ManagedRequest) => setClosing(request),
  }

  const closeDialog = {
    request: closing,
    loading: close.isPending,
    onCancel: () => setClosing(null),
    onConfirm: (reason: string) => {
      if (!closing) return
      close.mutate(
        { id: closing.id, reason },
        {
          onSuccess: (updated) => {
            setClosing(null)
            toast({ tone: 'info', title: t('actions.closed'), message: t('actions.closedBody', { id: updated.id }) })
          },
          onError: failed,
        },
      )
    },
  }

  return { run, closeDialog, pending: extend.isPending || fulfill.isPending }
}

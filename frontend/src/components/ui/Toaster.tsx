import { useSyncExternalStore } from 'react'
import { Toast } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { icons, type IconName } from './icons'
import { toastStore, type ToastItem, type ToastTone } from './toast'

const TONE: Record<ToastTone, { icon: IconName; tile: string }> = {
  success: { icon: 'check-circle', tile: 'bg-status-success text-status-success' },
  info: { icon: 'info', tile: 'bg-status-info text-status-info' },
  warning: { icon: 'alert-triangle', tile: 'bg-status-warning text-status-warning' },
  error: { icon: 'x-circle', tile: 'bg-status-critical text-status-critical' },
}

function ToastCard({ item }: { item: ToastItem }) {
  const { t } = useTranslation()
  const tone = TONE[item.tone]
  const Icon = icons[tone.icon]
  const isError = item.tone === 'error'

  return (
    <Toast.Root
      // Error: role=alert semantics (assertive) and never auto-dismissed.
      type={isError ? 'foreground' : 'background'}
      duration={isError ? Infinity : 5000}
      onOpenChange={(open) => !open && toastStore.dismiss(item.id)}
      className="flex w-95 max-w-full items-start gap-3 rounded-lg border border-default bg-surface p-3 shadow-floating"
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', tone.tile)}>
        <Icon aria-hidden size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Toast.Title className="type-label-m text-primary">{item.title}</Toast.Title>
        {item.message && <Toast.Description className="type-body-s text-secondary">{item.message}</Toast.Description>}
      </div>
      <Toast.Close aria-label={t('actions.dismiss')} className="shrink-0 rounded-sm text-secondary">
        <icons.x aria-hidden size={16} />
      </Toast.Close>
    </Toast.Root>
  )
}

/** Toast region (8:334): bottom-right on desktop, top on mobile. */
export function Toaster() {
  const { t } = useTranslation()
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot)

  return (
    <Toast.Provider label={t('toast.region')}>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
      <Toast.Viewport className="fixed inset-x-4 top-4 z-50 flex flex-col gap-2 outline-none lg:inset-x-auto lg:top-auto lg:right-6 lg:bottom-6" />
    </Toast.Provider>
  )
}

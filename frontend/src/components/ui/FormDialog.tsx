import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'
import { icons, type IconName } from './icons'

/** Modal Dialog (10:464): 480 w, radius 16, Elevation/3 over a 48 % scrim; Esc and ✕ cancel. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  tone = 'neutral',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  icon?: IconName
  tone?: 'neutral' | 'critical'
  children: ReactNode
}) {
  const { t } = useTranslation()
  const Icon = icon ? icons[icon] : null
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/48" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-120 max-w-[calc(100vw-32px)] -translate-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-6 shadow-overlay">
          <div className="flex items-start gap-3">
            {Icon && (
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-md',
                  tone === 'critical' ? 'bg-status-critical text-status-critical' : 'bg-subtle text-primary',
                )}
              >
                <Icon aria-hidden size={20} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="type-h3 text-primary">{title}</Dialog.Title>
              <Dialog.Description className="type-body-m text-secondary">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton icon="x" label={t('actions.close')} tooltip={false} className="-mt-2 -mr-2" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

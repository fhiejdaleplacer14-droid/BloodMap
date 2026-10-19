import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Logo } from '../../components/domain/Logo'
import { RequestMap } from '../../components/map/RequestMap'
import { icons, type IconName } from '../../components/ui/icons'
import { cn } from '../../lib/cn'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const AlertCircle = icons['alert-circle']

/**
 * Auth layout (05 · Authentication, 23:2): context aside with the NIR map
 * and "Browsing is always open" (≥ 1024 px), form column 400 wide.
 */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation('auth')
  useDocumentTitle(title)

  const points: Array<{ icon: IconName; text: string }> = [
    { icon: 'search', text: t('aside.browse') },
    { icon: 'bookmark', text: t('aside.save') },
    { icon: 'lock', text: t('aside.privacy') },
  ]

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="relative w-140 shrink-0 overflow-hidden border-r border-default max-lg:hidden">
        <div className="absolute inset-0">
          <RequestMap className="size-full" label={t('aside.eyebrow')} requests={[]} interactive={false} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-1000 flex flex-col justify-between p-10">
          <Link to="/" className="pointer-events-auto w-fit rounded-xl border border-default bg-surface px-5 py-4 shadow-floating">
            <Logo />
          </Link>
          <section className="pointer-events-auto flex flex-col gap-4 rounded-xl border border-default bg-surface p-6 shadow-floating">
            <h2 className="type-overline text-tertiary">{t('aside.eyebrow')}</h2>
            <ul className="flex flex-col gap-4">
              {points.map(({ icon, text }) => {
                const Icon = icons[icon]
                return (
                  <li key={icon} className="type-body-m flex gap-3 text-primary">
                    <Icon aria-hidden size={18} className="mt-px shrink-0 text-brand" />
                    {text}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </aside>
      <main id="main" className="flex min-w-0 flex-1 flex-col items-center justify-center bg-surface px-4 py-10">
        <Link to="/" className="mb-8 self-start rounded-sm lg:hidden">
          <Logo size="sm" />
        </Link>
        <div className="flex w-full max-w-100 flex-col gap-5">{children}</div>
      </main>
    </div>
  )
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="type-h1 text-primary">{title}</h1>
      {subtitle && <p className="type-body-m text-secondary">{subtitle}</p>}
    </div>
  )
}

/** Banner · critical / info (23:366, 23:990). */
export function Banner({ tone, title, children }: { tone: 'critical' | 'info'; title?: ReactNode; children?: ReactNode }) {
  const Icon = tone === 'critical' ? AlertCircle : icons.info
  return (
    <div
      role={tone === 'critical' ? 'alert' : undefined}
      className={cn(
        'flex gap-2.5 rounded-md px-3.5 py-3',
        tone === 'critical' ? 'bg-status-critical text-status-critical' : 'bg-status-info text-status-info',
      )}
    >
      <Icon aria-hidden size={18} className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="type-label-m">{title}</p>}
        {children && <p className="type-body-s">{children}</p>}
      </div>
    </div>
  )
}

/** Icon tile above success / info headings (23:975). */
export function IconTile({ icon, tone }: { icon: IconName; tone: 'success' | 'info' | 'neutral' }) {
  const Icon = icons[icon]
  return (
    <span
      className={cn(
        'flex size-12 items-center justify-center rounded-lg',
        tone === 'success' && 'bg-status-success text-status-success',
        tone === 'info' && 'bg-status-info text-status-info',
        tone === 'neutral' && 'bg-status-neutral text-status-neutral',
      )}
    >
      <Icon aria-hidden size={22} />
    </span>
  )
}

export function BackToSignIn() {
  const { t } = useTranslation('auth')
  const ArrowLeft = icons['arrow-left']
  return (
    <Link
      to="/login"
      className="type-label-m -ml-4 inline-flex h-10 w-fit items-center gap-2 rounded-md px-4 text-primary hover:bg-subtle"
    >
      <ArrowLeft aria-hidden size={16} />
      {t('recovery.back')}
    </Link>
  )
}


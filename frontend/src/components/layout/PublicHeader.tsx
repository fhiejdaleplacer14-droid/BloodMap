import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Logo } from '../domain/Logo'

/** `current` is explicit: section links (/#how-it-works) share a path with Home. */
export type PublicNavLink = { to: string; label: string; current?: boolean }

type PublicHeaderProps = {
  links: PublicNavLink[]
  /** Right side: Log In + Find a Request (Landing), Log In + Create account (Explorer), or account (signed in). */
  actions: ReactNode
  homeTo?: string
  className?: string
}

/**
 * Public Top Nav (12:512): 64 px, full-bleed surface, 1 px bottom border, no
 * shadow. Active link = 2 px crimson underline. Shown from 1024 px; below that
 * the Mobile Top Bar takes over.
 */
export function PublicHeader({ links, actions, homeTo = '/', className }: PublicHeaderProps) {
  const { t } = useTranslation(['nav', 'common'])
  return (
    <header className={cn('flex h-16 items-center justify-between border-b border-default bg-surface px-8', className)}>
      <div className="flex items-center gap-10">
        <Link to={homeTo} className="rounded-sm">
          <Logo />
        </Link>
        <nav aria-label={t('public.primary')}>
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  aria-current={link.current ? 'page' : undefined}
                  className={cn(
                    'type-label-m flex h-16 items-center border-b-2 px-3 transition-colors duration-150',
                    link.current
                      ? 'border-(--bg-brand) text-primary'
                      : 'border-transparent text-secondary hover:text-primary',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  )
}

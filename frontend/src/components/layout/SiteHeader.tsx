import { useState } from 'react'
import { Dialog, DropdownMenu } from 'radix-ui'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { homeFor, useLogout, useMe, type Me } from '../../lib/api/auth'
import { cn } from '../../lib/cn'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { icons } from '../ui/icons'
import { MobileTopBar } from './MobileTopBar'
import { PublicHeader, type PublicNavLink } from './PublicHeader'

const ChevronDown = icons['chevron-down']
const LogOut = icons['log-out']

type SiteHeaderProps = {
  /** Landing: Log In + Find a Request · Explorer: Log In + Create account (12:512). */
  cta: 'find' | 'create'
}

function useNavLinks(): PublicNavLink[] {
  const { t } = useTranslation('nav')
  const { pathname, hash } = useLocation()
  return [
    { to: '/requests', label: t('public.findRequests'), current: pathname.startsWith('/requests') },
    { to: '/#how-it-works', label: t('public.howItWorks'), current: pathname === '/' && hash === '#how-it-works' },
    { to: '/#safety', label: t('public.safety'), current: pathname === '/' && hash === '#safety' },
    { to: '/#about', label: t('public.about'), current: pathname === '/' && hash === '#about' },
  ]
}

/** Where to come back to after signing in. */
function useLoginHref() {
  const { pathname, search } = useLocation()
  const here = `${pathname}${search}`
  return here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`
}

function AccountMenu({ me }: { me: Me }) {
  const { t } = useTranslation(['nav', 'common'])
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('nav:public.account', { name: me.name })}
        className="type-label-m flex h-10 items-center gap-2 rounded-md px-2 text-primary hover:bg-subtle"
      >
        <Avatar initials={me.initials} />
        <span className="max-w-40 truncate max-lg:hidden">{me.name}</span>
        <ChevronDown aria-hidden size={16} className="text-secondary max-lg:hidden" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-lg border border-default bg-surface p-1 shadow-overlay"
        >
          <div className="px-3 py-2">
            <p className="type-label-m truncate text-primary">{me.name}</p>
            <p className="type-body-s truncate text-secondary">{me.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={() => navigate(homeFor(me))}
            className="type-body-m flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-primary outline-none data-highlighted:bg-subtle"
          >
            <icons.home aria-hidden size={16} />
            {t('nav:sidebar.workspace')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
            className="type-body-m flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-primary outline-none data-highlighted:bg-subtle"
          >
            <LogOut aria-hidden size={16} />
            {t('common:actions.signOut')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function MobileMenu({ cta }: SiteHeaderProps) {
  const { t } = useTranslation(['nav', 'common'])
  const [open, setOpen] = useState(false)
  const links = useNavLinks()
  const loginHref = useLoginHref()
  const { data: me } = useMe()

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <IconButton icon="menu" label={t('common:actions.menu')} tooltip={false} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/50" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(320px,100%)] flex-col gap-2 bg-surface p-4 shadow-overlay">
          <div className="flex items-center justify-between">
            <Dialog.Title className="type-h4 text-primary">{t('nav:public.menu')}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon="x" label={t('common:actions.close')} tooltip={false} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t('nav:public.primary')}</Dialog.Description>
          <nav aria-label={t('nav:public.primary')}>
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={() => setOpen(false)}
                    aria-current={link.current ? 'page' : undefined}
                    className={cn(
                      'type-label-m flex min-h-11 items-center rounded-md px-3',
                      link.current ? 'bg-brand-soft text-brand' : 'text-primary hover:bg-subtle',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {!me && (
            <div className="mt-auto flex flex-col gap-2">
              <Button asChild variant="secondary">
                <Link to={loginHref} onClick={() => setOpen(false)}>
                  {t('nav:public.logIn')}
                </Link>
              </Button>
              {cta === 'create' ? (
                <Button asChild variant="primary">
                  <Link to="/register" onClick={() => setOpen(false)}>
                    {t('nav:public.createAccount')}
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="brand">
                  <Link to="/requests" onClick={() => setOpen(false)}>
                    <icons.search aria-hidden size={16} />
                    {t('nav:public.findARequest')}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Public header: Public Top Nav from 1024 px, Mobile Top Bar below. Actions
 * come from /api/me — guests see Log In, signed-in users their account.
 */
export function SiteHeader({ cta }: SiteHeaderProps) {
  const { t } = useTranslation('nav')
  const links = useNavLinks()
  const loginHref = useLoginHref()
  const { data: me } = useMe()

  const guestActions = (
    <>
      <Button asChild variant="tertiary">
        <Link to={loginHref}>{t('public.logIn')}</Link>
      </Button>
      {cta === 'create' ? (
        <Button asChild variant="primary">
          <Link to="/register">{t('public.createAccount')}</Link>
        </Button>
      ) : (
        <Button asChild variant="brand">
          <Link to="/requests">
            <icons.search aria-hidden size={16} />
            {t('public.findARequest')}
          </Link>
        </Button>
      )}
    </>
  )

  return (
    <>
      <PublicHeader className="max-lg:hidden" links={links} actions={me ? <AccountMenu me={me} /> : guestActions} />
      <MobileTopBar
        className="lg:hidden"
        actions={
          <>
            {me && <AccountMenu me={me} />}
            <MobileMenu cta={cta} />
          </>
        }
      />
    </>
  )
}

export function SkipLink({ href = '#main' }: { href?: string }) {
  const { t } = useTranslation('nav')
  return (
    <a
      href={href}
      className="type-label-m sr-only z-50 rounded-md bg-surface px-4 py-2 text-primary shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      {t('skipToContent')}
    </a>
  )
}


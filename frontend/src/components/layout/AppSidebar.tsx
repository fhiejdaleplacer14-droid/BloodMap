import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Logo } from '../domain/Logo'
import { Avatar } from '../ui/Avatar'
import { IconButton } from '../ui/IconButton'
import { icons, type IconName } from '../ui/icons'
import { SidebarNavItem, type SidebarItem } from './SidebarNavItem'

type AppSidebarProps = {
  /** Role chip, e.g. "Donor account" / "Coordinator · Negros Occ. (North)". */
  roleLabel: string
  roleIcon: IconName
  /** Rendered from the user's permissions (/api/me) — never hidden with CSS. */
  items: SidebarItem[]
  helpItem: SidebarItem
  user: { name: string; email: string; initials: string }
  onSignOut: () => void
  homeTo?: string
  className?: string
}

export function AppSidebar({ roleLabel, roleIcon, items, helpItem, user, onSignOut, homeTo = '/', className }: AppSidebarProps) {
  const { t } = useTranslation(['nav', 'common'])
  const RoleIcon = icons[roleIcon]

  return (
    <aside className={cn('flex h-full w-66 flex-col gap-1 border-r border-default bg-canvas px-4 py-5', className)}>
      <div className="pb-3 pl-2">
        <Link to={homeTo} className="inline-flex rounded-sm">
          <Logo />
        </Link>
      </div>
      <p className="type-label-s flex items-center gap-1.5 truncate rounded-sm bg-subtle px-2 py-1.5 text-secondary">
        <RoleIcon aria-hidden size={14} className="shrink-0" />
        {roleLabel}
      </p>
      <nav aria-label={t('sidebar.label')} className="flex flex-1 flex-col gap-1">
        <h2 className="type-overline pt-4 pb-1 pl-3 text-tertiary">{t('sidebar.workspace')}</h2>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.to}>
              <SidebarNavItem {...item} />
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          <SidebarNavItem {...helpItem} />
        </div>
      </nav>
      <div className="flex items-center gap-2.5 rounded-lg border border-default bg-surface p-3">
        <Avatar initials={user.initials} size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="type-label-m truncate text-primary">{user.name}</span>
          <span className="type-body-s truncate text-tertiary">{user.email}</span>
        </div>
        <IconButton icon="log-out" label={t('common:actions.signOut')} onClick={onSignOut} />
      </div>
    </aside>
  )
}

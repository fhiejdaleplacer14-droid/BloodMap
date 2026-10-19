import type { TFunction } from 'i18next'
import type { BottomNavItem } from '../components/layout/BottomNav'
import type { SidebarItem } from '../components/layout/SidebarNavItem'
import type { IconName } from '../components/ui/icons'
import type { Me } from './api/auth'

type NavEntry = { key: string; to: string; icon: IconName; end?: boolean; permission?: string }

/**
 * Workspace navigation, rendered from /api/me permissions — items a user
 * can't access are never rendered (51:298, decision #11).
 */
const DONOR: NavEntry[] = [
  { key: 'overview', to: '/app', icon: 'home', end: true },
  { key: 'explore', to: '/requests', icon: 'search' },
  { key: 'saved', to: '/app/saved', icon: 'bookmark', permission: 'requests.save' },
  { key: 'activity', to: '/app/activity', icon: 'activity' },
  { key: 'notifications', to: '/app/notifications', icon: 'bell' },
  { key: 'profile', to: '/app/profile', icon: 'user' },
]

export function workspaceNav(me: Me, t: TFunction<'workspace'>, counts: { unread?: number } = {}): SidebarItem[] {
  return DONOR.filter((entry) => !entry.permission || me.permissions.includes(entry.permission)).map((entry) => ({
    to: entry.to,
    label: t(`nav.${entry.key}` as 'nav.overview'),
    icon: entry.icon,
    end: entry.end,
    count: entry.key === 'notifications' && counts.unread ? counts.unread : undefined,
  }))
}

/** Bottom navigation below 1024 px (5 items, 55:269). */
export function workspaceBottomNav(t: TFunction<'workspace'>): BottomNavItem[] {
  return [
    { to: '/app', label: t('bottom.home'), icon: 'home', end: true },
    { to: '/requests', label: t('bottom.explore'), icon: 'search' },
    { to: '/app/saved', label: t('bottom.saved'), icon: 'bookmark' },
    { to: '/app/notifications', label: t('bottom.alerts'), icon: 'bell' },
    { to: '/app/profile', label: t('bottom.profile'), icon: 'user' },
  ]
}

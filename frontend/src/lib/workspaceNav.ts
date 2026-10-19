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

/** Facility submitter sidebar (32:841). */
const SUBMITTER: NavEntry[] = [
  { key: 'overview', to: '/app', icon: 'home', end: true },
  { key: 'myRequests', to: '/requests/mine', icon: 'list', permission: 'requests.own' },
  { key: 'createRequest', to: '/requests/new', icon: 'plus', permission: 'requests.create' },
  { key: 'drafts', to: '/requests/drafts', icon: 'file-text', permission: 'requests.own' },
  { key: 'notifications', to: '/app/notifications', icon: 'bell' },
  { key: 'profile', to: '/app/profile', icon: 'user' },
]

export type NavCounts = { unread?: number; active?: number; drafts?: number }

const COUNT_FOR: Record<string, keyof NavCounts> = { notifications: 'unread', myRequests: 'active', drafts: 'drafts' }

export function isSubmitter(me: Me): boolean {
  return me.permissions.includes('requests.own')
}

export function workspaceNav(me: Me, t: TFunction<'workspace'>, counts: NavCounts = {}): SidebarItem[] {
  return (isSubmitter(me) ? SUBMITTER : DONOR).filter((entry) => !entry.permission || me.permissions.includes(entry.permission)).map((entry) => ({
    to: entry.to,
    label: t(`nav.${entry.key}` as 'nav.overview'),
    icon: entry.icon,
    end: entry.end,
    count: COUNT_FOR[entry.key] ? counts[COUNT_FOR[entry.key]] || undefined : undefined,
  }))
}

/** Bottom navigation below 1024 px (5 items, 55:269). */
export function workspaceBottomNav(me: Me, t: TFunction<'workspace'>): BottomNavItem[] {
  if (isSubmitter(me)) {
    return [
      { to: '/app', label: t('bottom.home'), icon: 'home', end: true },
      { to: '/requests/mine', label: t('bottom.requests'), icon: 'list' },
      { to: '/requests/new', label: t('bottom.create'), icon: 'plus' },
      { to: '/app/notifications', label: t('bottom.alerts'), icon: 'bell' },
      { to: '/app/profile', label: t('bottom.profile'), icon: 'user' },
    ]
  }
  return [
    { to: '/app', label: t('bottom.home'), icon: 'home', end: true },
    { to: '/requests', label: t('bottom.explore'), icon: 'search' },
    { to: '/app/saved', label: t('bottom.saved'), icon: 'bookmark' },
    { to: '/app/notifications', label: t('bottom.alerts'), icon: 'bell' },
    { to: '/app/profile', label: t('bottom.profile'), icon: 'user' },
  ]
}

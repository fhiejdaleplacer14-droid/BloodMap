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

/**
 * Coordinator sidebar (35:12). "Reports" is left out until its flow and
 * endpoint exist (open item, decision #54).
 */
const COORDINATOR: NavEntry[] = [
  { key: 'coord.overview', to: '/coord', icon: 'home', end: true, permission: 'review.queue' },
  { key: 'coord.queue', to: '/coord/queue', icon: 'clipboard-check', permission: 'review.queue' },
  { key: 'coord.active', to: '/coord/active', icon: 'list', permission: 'review.queue' },
  { key: 'coord.closed', to: '/coord/closed', icon: 'lock', permission: 'review.queue' },
  { key: 'coord.activity', to: '/coord/activity', icon: 'history', permission: 'review.activity' },
  { key: 'coord.profile', to: '/app/profile', icon: 'user' },
]

export type NavCounts = { unread?: number; active?: number; drafts?: number; queue?: number }

const COUNT_FOR: Record<string, keyof NavCounts> = {
  notifications: 'unread',
  myRequests: 'active',
  drafts: 'drafts',
  'coord.queue': 'queue',
}

export function isSubmitter(me: Me): boolean {
  return me.permissions.includes('requests.own')
}

/** Coordinators and admins review; admins get their own workspace later (09). */
export function isCoordinator(me: Me): boolean {
  return me.role === 'coordinator'
}

function entriesFor(me: Me): NavEntry[] {
  if (isCoordinator(me)) return COORDINATOR
  return isSubmitter(me) ? SUBMITTER : DONOR
}

export function workspaceNav(me: Me, t: TFunction<['workspace', 'coord']>, counts: NavCounts = {}): SidebarItem[] {
  return entriesFor(me).filter((entry) => !entry.permission || me.permissions.includes(entry.permission)).map((entry) => ({
    to: entry.to,
    label: entry.key.startsWith('coord.') ? t(`coord:nav.${entry.key.slice(6)}` as 'coord:nav.overview') : t(`nav.${entry.key}` as 'nav.overview'),
    icon: entry.icon,
    end: entry.end,
    count: COUNT_FOR[entry.key] ? counts[COUNT_FOR[entry.key]] || undefined : undefined,
  }))
}

/** Bottom navigation below 1024 px (5 items, 55:269). */
export function workspaceBottomNav(me: Me, t: TFunction<['workspace', 'coord']>): BottomNavItem[] {
  if (isCoordinator(me)) {
    return [
      { to: '/coord', label: t('coord:bottom.home'), icon: 'home', end: true },
      { to: '/coord/queue', label: t('coord:bottom.queue'), icon: 'clipboard-check' },
      { to: '/coord/active', label: t('coord:bottom.active'), icon: 'list' },
      { to: '/coord/activity', label: t('coord:bottom.activity'), icon: 'history' },
      { to: '/app/profile', label: t('coord:bottom.profile'), icon: 'user' },
    ]
  }
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

import type { TFunction } from 'i18next'
import type { ActivityItem } from '../../lib/api/me'

type T = TFunction<'workspace'>

/** "Saved a request" — unknown actions fall back to their key. */
export function activityLabel(item: ActivityItem, t: T): string {
  const key = `activity.actions.${item.action}`
  const label = t(key as 'activity.actions.request.saved', { defaultValue: '' })
  return label || item.action
}

/** Detail column (29:781): device for sign-ins, what changed for preferences. */
export function activityDetail(item: ActivityItem, t: T, emailFollowing: boolean): string | null {
  if (item.action === 'account.signed_in') return item.device
  if (item.action === 'request.saved') return emailFollowing ? t('activity.following') : null
  if (item.action === 'account.preferences_updated' && item.changes) {
    return Object.entries(item.changes)
      .map(([key, on]) =>
        t(on ? 'activity.turnedOn' : 'activity.turnedOff', {
          name: t(`activity.prefs.${key}` as 'activity.prefs.email_expiry_reminder', { defaultValue: key }),
        }),
      )
      .join(', ')
  }
  return null
}

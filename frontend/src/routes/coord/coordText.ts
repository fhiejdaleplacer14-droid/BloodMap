import type { TFunction } from 'i18next'
import type { ActivityRow } from '../../lib/api/coordinator'
import { formatShortDateTime } from '../../lib/datetime'

/** "42 min" · "3 h 10 min" · "2 d 3 h" — waiting times on the queue (35:12). */
export function durationLabel(fromIso: string, t: TFunction<'coord'>, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60_000))
  if (minutes < 60) return t('duration.minutes', { m: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('duration.hours', { h: hours, m: String(minutes % 60).padStart(2, '0') })
  return t('duration.days', { d: Math.floor(hours / 24), h: hours % 24 })
}

/** Time left until a future instant, compact ("6 h", "45 min"). */
export function untilLabel(toIso: string, t: TFunction<'coord'>, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((new Date(toIso).getTime() - now.getTime()) / 60_000))
  return minutes < 60 ? t('duration.minutes', { m: minutes }) : `${Math.floor(minutes / 60)} h`
}

export function agoLabel(iso: string, t: TFunction<'coord'>, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return t('overview.ago.justNow')
  if (minutes < 60) return t('overview.ago.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('overview.ago.hours', { count: hours })
  return t('overview.ago.days', { count: Math.floor(hours / 24) })
}

export function actionLabel(action: string, t: TFunction<'coord'>): string {
  return t(`activity.actions.${action}` as 'activity.actions.request.created', { defaultValue: action })
}

/** Context column of the activity log (36:1105). */
export function activityContext(row: Pick<ActivityRow, 'action' | 'reason' | 'fields' | 'to'>, t: TFunction<['coord', 'manage']>, locale: string): string {
  if (row.reason) return t('coord:activity.context.reason', { reason: row.reason })
  switch (row.action) {
    case 'request.approved':
      return t('coord:activity.context.approved')
    case 'request.expired':
      return t('coord:activity.context.expired')
    case 'request.assigned':
      return row.to ? t('coord:activity.context.assigned', { name: row.to }) : ''
    case 'request.extended':
      return row.to ? t('coord:activity.context.extended', { when: formatShortDateTime(row.to, locale) }) : ''
  }
  if (row.fields.length) {
    const fields = [...new Set(row.fields.map((f) => t(`manage:fieldNames.${f}` as 'manage:fieldNames.blood_type', { defaultValue: f })))]
    return t('coord:activity.context.changed', { fields: fields.join(', ') })
  }
  return ''
}

export const reviewHref = (id: string) => `/coord/requests/${encodeURIComponent(id)}`

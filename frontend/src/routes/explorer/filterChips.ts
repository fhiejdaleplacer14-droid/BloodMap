import { useTranslation } from 'react-i18next'
import { formatCalendarDate } from '../../lib/datetime'
import { DEFAULT_FILTERS, type ExplorerFilters, type ExplorerParams, type PublicStatus } from '../../lib/explorer/params'
import { displayBloodType } from '../../lib/request'

export type AppliedChip = { key: string; label: string; remove: () => void }

/** Status is "applied" only when it differs from the Active default. */
export function hasStatusChip(status: PublicStatus[]): boolean {
  return !(status.length === 1 && status[0] === 'active')
}

/** "Filters · 2" (25:42): how many filter groups differ from the defaults. */
export function appliedGroupCount(params: Pick<ExplorerParams, 'types' | 'urgency' | 'status' | 'posted' | 'from' | 'to' | 'area'>): number {
  return [
    params.types.length > 0,
    params.urgency.length > 0,
    hasStatusChip(params.status),
    Boolean(params.posted || params.from || params.to),
    params.area !== null,
  ].filter(Boolean).length
}

/** Applied filter chips (14:88 · 25:98): each one removes itself. */
export function useFilterChips(params: ExplorerParams, updateFilters: (patch: Partial<ExplorerFilters>) => void): AppliedChip[] {
  const { t, i18n } = useTranslation(['explorer', 'request'])
  const locale = i18n.language
  return [
    ...params.types.map((type) => ({
      key: `type-${type}`,
      label: t('filters.chips.type', { value: displayBloodType(type) }),
      remove: () => updateFilters({ types: params.types.filter((v) => v !== type) }),
    })),
    ...params.urgency.map((urgency) => ({
      key: `urgency-${urgency}`,
      label: t('filters.chips.urgency', { value: t(`request:urgency.${urgency}`) }),
      remove: () => updateFilters({ urgency: params.urgency.filter((v) => v !== urgency) }),
    })),
    ...(hasStatusChip(params.status)
      ? params.status.map((status) => ({
          key: `status-${status}`,
          label: t('filters.chips.status', { value: t(`filters.statuses.${status}`) }),
          remove: () =>
            updateFilters({ status: params.status.length > 1 ? params.status.filter((v) => v !== status) : DEFAULT_FILTERS.status }),
        }))
      : []),
    ...(params.posted
      ? [{ key: 'posted', label: t('filters.chips.posted', { value: t(`filters.postedRanges.${params.posted}`) }), remove: () => updateFilters({ posted: null }) }]
      : []),
    ...(params.from || params.to
      ? [
          {
            key: 'range',
            label:
              params.from && params.to
                ? t('filters.chips.postedRange', { from: formatCalendarDate(params.from, locale), to: formatCalendarDate(params.to, locale) })
                : params.from
                  ? t('filters.chips.postedFrom', { from: formatCalendarDate(params.from, locale) })
                  : t('filters.chips.postedTo', { to: formatCalendarDate(params.to as string, locale) }),
            remove: () => updateFilters({ from: null, to: null }),
          },
        ]
      : []),
    ...(params.area
      ? [{ key: 'area', label: t('filters.chips.area', { value: t(`filters.areas.${params.area}`) }), remove: () => updateFilters({ area: null }) }]
      : []),
  ]
}

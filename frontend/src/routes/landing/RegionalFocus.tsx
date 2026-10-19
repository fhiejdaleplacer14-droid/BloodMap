import { useEffect, useMemo, useState } from 'react'
import type L from 'leaflet'
import { latLngBounds } from 'leaflet'
import { RadioGroup } from 'radix-ui'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { DemoBadge } from '../../components/map/MapOverlays'
import { NIR_BOUNDS, prefersReducedMotion, toLatLng } from '../../components/map/mapConfig'
import { RequestMap } from '../../components/map/RequestMap'
import { icons } from '../../components/ui/icons'
import { useMunicipalities, usePublicStats } from '../../lib/api/requests'
import { cn } from '../../lib/cn'
import { AREA_PROVINCE, type Area } from '../../lib/explorer/params'
import type { PublicRequest } from '../../lib/request'

const ChevronRight = icons['chevron-right']

type Choice = 'all' | Exclude<Area, 'near'>
const CHOICES: Choice[] = ['all', 'occidental', 'oriental', 'siquijor']

/**
 * Regional focus (21:3649). Counts come from /api/stats/public. There are no
 * province boundaries in the data, so a selected province is framed by its
 * municipalities rather than outlined (decision #30).
 */
export function RegionalFocus({ requests }: { requests: PublicRequest[] }) {
  const { t } = useTranslation(['landing', 'explorer'])
  const stats = usePublicStats().data
  const municipalities = useMunicipalities().data
  const [choice, setChoice] = useState<Choice>('occidental')
  const [map, setMap] = useState<L.Map | null>(null)
  const demo = stats?.is_demo ?? false

  const countFor = (c: Choice) => (c === 'all' ? stats?.active_requests : (stats?.by_province[AREA_PROVINCE[c]] ?? 0))
  const nameFor = (c: Choice) => (c === 'all' ? t('landing:region.all') : AREA_PROVINCE[c])

  const bounds = useMemo(() => {
    if (choice === 'all' || !municipalities) return null
    const points = municipalities.filter((m) => m.province === AREA_PROVINCE[choice]).map((m) => toLatLng(m.point))
    return points.length ? latLngBounds(points).pad(0.08) : null
  }, [choice, municipalities])

  useEffect(() => {
    if (!map) return
    map.fitBounds(bounds ?? NIR_BOUNDS, { animate: !prefersReducedMotion() })
  }, [map, bounds])

  const visible = choice === 'all' ? requests : requests.filter((r) => r.location.province === AREA_PROVINCE[choice])
  const selectedCount = countFor(choice)
  const exploreHref = choice === 'all' ? '/requests' : `/requests?area=${choice}`

  return (
    <section className="bg-surface px-[clamp(16px,8vw,120px)] py-[clamp(56px,7vw,96px)]">
      <div className="mx-auto flex max-w-[1200px] items-center gap-16 max-lg:flex-col max-lg:items-stretch max-lg:gap-10">
        <div className="flex w-[440px] max-w-full shrink-0 flex-col gap-5">
          <p className="type-overline text-tertiary">{t('landing:region.eyebrow')}</p>
          <h2 className="type-h1 text-primary">{t('landing:region.title')}</h2>
          <p className="type-body-l text-secondary">{t('landing:region.body')}</p>
          <RadioGroup.Root
            value={choice}
            onValueChange={(value) => setChoice(value as Choice)}
            aria-label={t('landing:region.areasLabel')}
            className="flex flex-col overflow-hidden rounded-lg border border-default"
          >
            {CHOICES.map((c) => {
              const count = countFor(c)
              return (
                <RadioGroup.Item
                  key={c}
                  value={c}
                  className={cn(
                    'group flex items-center justify-between gap-3 border-b border-default px-4 py-3.5 text-left last:border-b-0',
                    'data-[state=checked]:bg-brand-soft hover:bg-subtle data-[state=checked]:hover:bg-brand-soft',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full border border-strong bg-surface group-data-[state=checked]:border-[5px] group-data-[state=checked]:border-brand"
                    />
                    <span className="type-label-m text-primary group-data-[state=checked]:text-brand">{nameFor(c)}</span>
                  </span>
                  {count !== undefined && (
                    <span className="flex items-center gap-1 text-[0.8125rem]/[1.125rem]">
                      <span className="type-mono-m text-primary group-data-[state=checked]:text-brand">{count}</span>
                      {demo && <span className="text-tertiary">{t('landing:region.sample')}</span>}
                    </span>
                  )}
                </RadioGroup.Item>
              )
            })}
          </RadioGroup.Root>
          {demo && (
            <p className="type-body-s flex gap-2 text-status-info">
              <icons.info aria-hidden size={16} className="mt-px shrink-0" />
              {t('landing:region.demoDisclaimer')}
            </p>
          )}
        </div>

        <div className="relative h-[520px] min-w-0 flex-1 overflow-hidden rounded-xl border border-default max-sm:h-[400px]">
          <RequestMap
            className="size-full"
            label={t('landing:region.mapLabel', { area: nameFor(choice) })}
            requests={visible}
            interactive={false}
            onMapReady={setMap}
          >
            <div className="pointer-events-none absolute inset-0 z-[1000]">
              {demo && <DemoBadge className="absolute top-4 left-4">{t('landing:region.demoChip')}</DemoBadge>}
              {selectedCount !== undefined && (
                <Link
                  to={exploreHref}
                  className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-brand bg-surface px-2.5 py-1.5 whitespace-nowrap shadow-raised hover:bg-brand-soft"
                >
                  <span className="type-label-m text-brand">{nameFor(choice)}</span>
                  <span className="type-mono-s text-secondary">
                    {demo
                      ? t('landing:region.provinceRequests', { count: selectedCount })
                      : t('landing:region.provinceLive', { count: selectedCount })}
                  </span>
                  <ChevronRight aria-hidden size={14} className="text-brand" />
                </Link>
              )}
            </div>
          </RequestMap>
        </div>
      </div>
    </section>
  )
}

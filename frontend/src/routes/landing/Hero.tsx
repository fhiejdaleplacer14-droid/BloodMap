import { useEffect, useState } from 'react'
import type L from 'leaflet'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { RequestCard } from '../../components/domain/RequestCard'
import { DemoBadge } from '../../components/map/MapOverlays'
import { toLatLng } from '../../components/map/mapConfig'
import { RequestMap } from '../../components/map/RequestMap'
import { Button } from '../../components/ui/Button'
import { icons } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import type { PublicRequest } from '../../lib/request'

/**
 * Hero (20:3439). The map composition is a live, static Leaflet preview of
 * real requests (never an image, 13:682); the card shows the most recently
 * updated one.
 */
export function Hero({ requests, loading }: { requests: PublicRequest[]; loading: boolean }) {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const featured = requests[0] ?? null
  const demo = requests.some((r) => r.is_demo)
  const [map, setMap] = useState<L.Map | null>(null)

  // Frame the featured request's area, as in the composition (20:3477).
  useEffect(() => {
    if (!map || !featured) return
    // Zoom where the approximate area reads; nudge it above the card overlay.
    map.setView(toLatLng(featured.location.point), 10.5, { animate: false })
    map.panBy([0, 110], { animate: false })
  }, [map, featured])

  return (
    <section className="border-b border-default bg-canvas px-[clamp(16px,8vw,120px)] py-[clamp(40px,6vw,72px)]">
      <div className="mx-auto flex max-w-300 items-center gap-16 max-lg:flex-col max-lg:items-stretch max-lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <p className="type-overline flex items-center gap-2 text-brand">
            <span aria-hidden className="size-2 rounded-full bg-brand" />
            {t('hero.eyebrow')}
          </p>
          <h1 className="type-display-56 max-w-145 text-primary max-sm:text-[2.5rem] max-sm:leading-11.5">
            {t('hero.title')}
          </h1>
          <p className="type-body-l max-w-125 text-secondary">{t('hero.body')}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="brand">
              <Link to="/requests">
                <icons.search aria-hidden size={16} />
                {t('hero.explore')}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/#how-it-works">{t('hero.howItWorks')}</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {(['free', 'noAccount', 'generalized'] as const).map((key) => (
              <li key={key} className="type-body-s flex items-center gap-1.5 text-secondary">
                <icons.check aria-hidden size={16} className="shrink-0 text-status-success" />
                {t(`hero.assurances.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative h-135 w-full shrink-0 overflow-hidden rounded-xl border border-default shadow-floating lg:w-154 max-sm:h-120">
          <RequestMap
            className="size-full"
            label={t('hero.mapLabel')}
            requests={requests}
            selectedId={featured?.id ?? null}
            areaFor={featured}
            interactive={false}
            onMapReady={setMap}
          >
            <div className="pointer-events-none absolute inset-0 z-1000">
              <form
                role="search"
                onSubmit={(event) => {
                  event.preventDefault()
                  const q = query.trim()
                  navigate(q ? `/requests?q=${encodeURIComponent(q)}` : '/requests')
                }}
                className="pointer-events-auto absolute top-4 left-4 flex h-11 w-90 max-w-[calc(100%-32px)] items-center gap-2.5 rounded-[10px] border border-default bg-surface pr-2 pl-3.5 shadow-floating focus-within:border-focus focus-within:shadow-focus"
              >
                <icons.search aria-hidden size={18} className="shrink-0 text-secondary" />
                <label htmlFor="hero-search" className="sr-only">
                  {t('hero.searchLabel')}
                </label>
                <input
                  id="hero-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('hero.searchLabel')}
                  maxLength={100}
                  className="type-body-m min-w-0 flex-1 bg-transparent text-primary outline-none placeholder:text-tertiary focus-visible:shadow-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                <span aria-hidden className="h-6 w-px bg-line" />
                <Link
                  to="/requests?area=near"
                  aria-label={t('hero.useLocation')}
                  title={t('hero.useLocation')}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-primary hover:bg-subtle"
                >
                  <icons.locate aria-hidden size={18} />
                </Link>
              </form>

              {demo && <DemoBadge className="absolute top-6.5 right-4 max-sm:top-17 max-sm:left-4">{t('hero.sampleData')}</DemoBadge>}

              <div className="pointer-events-auto absolute bottom-6 left-4 w-95 max-w-[calc(100%-32px)]">
                {featured ? (
                  <RequestCard request={featured} to={`/requests?sel=${encodeURIComponent(featured.id)}`} className="shadow-overlay" />
                ) : (
                  loading && <Skeleton className="h-55 w-full rounded-lg" />
                )}
              </div>
            </div>
          </RequestMap>
        </div>
      </div>
    </section>
  )
}

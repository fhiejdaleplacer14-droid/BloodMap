import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type L from 'leaflet'
import { latLngBounds } from 'leaflet'
import { useTranslation } from 'react-i18next'
import { SiteHeader, SkipLink } from '../../components/layout/SiteHeader'
import { DemoBadge, MapChip, MapControls, MapKey } from '../../components/map/MapOverlays'
import {
  FOCUS_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  NIR_BOUNDS,
  prefersReducedMotion,
  toLatLng,
  VIEW_DEBOUNCE_MS,
} from '../../components/map/mapConfig'
import { RequestMap, type MapView } from '../../components/map/RequestMap'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { toast, toastStore } from '../../components/ui/toast'
import {
  usePublicCoordinationPoints,
  useMunicipalities,
  useRequestDetail,
  useRequestSearch,
  type Paginated,
} from '../../lib/api/requests'
import { cn } from '../../lib/cn'
import {
  AREA_PROVINCE,
  bboxKey,
  DEFAULT_FILTERS,
  filtersOf,
  toSearchQuery,
  type View,
} from '../../lib/explorer/params'
import { distanceKm, locateOnce, useDebouncedCallback, useGeolocation, useMinWidth, useOnline } from '../../lib/hooks'
import { displayBloodType, RECEDED_STATUSES, type PublicRequest } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { RequestDetailsPanel } from './RequestDetailsPanel'
import { ResultsPanel } from './ResultsPanel'
import { SearchFilters } from './SearchFilters'
import { useExplorerParams } from './useExplorerParams'

const boundsKey = (bounds: L.LatLngBounds) =>
  bboxKey({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() })

/**
 * Request Explorer (04 · Public Website, 19:4701). The URL is the source of
 * truth; list and map stay in sync (55:192); every list and map state is
 * designed: initial, loading, results, no results, map failed, network
 * error with stale results, expired and closed requests.
 */
export function ExplorerPage() {
  const { t } = useTranslation(['explorer', 'states'])
  useDocumentTitle(t('pageTitle'))
  const { params, update, updateFilters, hrefFor } = useExplorerParams()
  const isTablet = useMinWidth('md')
  const isDesktop = useMinWidth('lg')
  const online = useOnline()

  const [map, setMap] = useState<L.Map | null>(null)
  const [zoom, setZoom] = useState<number>(params.z ?? 9)
  /** bbox used by the query. */
  const [bbox, setBbox] = useState<string | null>(null)
  /** Mobile: the map moved but "Search this area" hasn't been pressed (55:206). */
  const [pendingBbox, setPendingBbox] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [tileKey, setTileKey] = useState(0)
  const [mapFailed, setMapFailed] = useState(false)
  const [keyOpen, setKeyOpen] = useState(true)

  // Search this area is automatic on tablet/desktop, a button on mobile.
  const autoSearch = isTablet
  const mapVisible = isTablet ? params.view !== 'list' : params.view === 'map' && params.sel === null
  const nearMe = params.area === 'near'
  const geo = useGeolocation(nearMe)

  // ── Results ────────────────────────────────────────────────────────────
  const filters = filtersOf(params)
  const query = toSearchQuery(filters, { sort: params.sort, page: params.page, bbox: mapVisible ? bbox : null })
  const search = useRequestSearch(query, { enabled: !mapVisible || bbox !== null })

  // Last successful results stay on screen when a refresh fails (55:359).
  const [lastGood, setLastGood] = useState<{ data: Paginated<PublicRequest>; at: number } | null>(null)
  const fresh = search.isSuccess && !search.isPlaceholderData ? search.data : null
  if (fresh && fresh !== lastGood?.data) setLastGood({ data: fresh, at: search.dataUpdatedAt })
  const shown = search.data ?? lastGood?.data ?? null
  const offline = !online || search.fetchStatus === 'paused'
  const failed = search.isError && !shown
  const stale = Boolean(shown) && (search.isError || offline)
  const initialLoading = !shown && !failed

  const items = useMemo(() => {
    const list = shown?.data ?? []
    if (!nearMe || !geo.coords) return list
    const here = geo.coords
    return [...list].sort(
      (a, b) =>
        distanceKm(here, { lat: a.location.point[1], lng: a.location.point[0] }) -
        distanceKm(here, { lat: b.location.point[1], lng: b.location.point[0] }),
    )
  }, [shown, nearMe, geo.coords])

  // "You're offline" toast (19:1852); refetch happens on reconnect.
  useEffect(() => {
    if (online) return
    const id = toast({ tone: 'error', title: t('results.offlineTitle'), message: t('results.offlineBody') })
    return () => toastStore.dismiss(id)
  }, [online, t])

  // ── Selection ──────────────────────────────────────────────────────────
  const selected = useRequestDetail(params.sel).data ?? null
  const areaFor =
    selected ?? (highlighted ? (items.find((r) => r.id === highlighted) ?? null) : null)
  const returnFocusTo = useRef<string | null>(null)

  const closeDetails = useCallback(() => {
    returnFocusTo.current = params.sel
    update({ sel: null })
  }, [params.sel, update])

  // Close returns focus to the originating card (55:222).
  useEffect(() => {
    if (params.sel || !returnFocusTo.current) return
    const id = returnFocusTo.current
    returnFocusTo.current = null
    requestAnimationFrame(() => document.getElementById(`request-card-${id}`)?.focus())
  }, [params.sel])

  // Selecting eases the map to the generalized area at zoom ≤ 12 (55:220).
  const easedFor = useRef<string | null>(params.c ? params.sel : null)
  useEffect(() => {
    if (!map || !selected || easedFor.current === selected.id) return
    easedFor.current = selected.id
    if (RECEDED_STATUSES.has(selected.status)) return
    const target = toLatLng(selected.location.point)
    const nextZoom = Math.min(FOCUS_ZOOM, Math.max(map.getZoom(), 11))
    if (prefersReducedMotion()) map.setView(target, nextZoom)
    else map.flyTo(target, nextZoom, { duration: 0.25 })
  }, [map, selected])

  // ── Viewport ───────────────────────────────────────────────────────────
  const lastWritten = useRef<string | null>(null)
  const commitView = useDebouncedCallback((view: MapView) => {
    const key = boundsKey(view.bounds)
    if (autoSearch) setBbox(key)
    else setPendingBbox(key)
    const c: [number, number] = [Number(view.center[0].toFixed(2)), Number(view.center[1].toFixed(2))]
    lastWritten.current = `${c.join(',')}@${view.zoom}`
    // Viewport replaces history; filters and selection push it (55:206).
    update({ c, z: view.zoom }, { replace: true })
  }, VIEW_DEBOUNCE_MS)

  const onViewChange = useCallback(
    (view: MapView) => {
      setZoom(view.zoom)
      commitView(view)
    },
    [commitView],
  )

  const onMapReady = useCallback((instance: L.Map) => {
    setMap(instance)
    setZoom(instance.getZoom())
    // First query waits for the real viewport, so it never fetches twice.
    setBbox((current) => current ?? boundsKey(instance.getBounds()))
  }, [])

  // Back / Forward and "Find active requests nearby" move the map.
  useEffect(() => {
    if (!map || !params.c || params.z === null) return
    if (lastWritten.current === `${params.c.join(',')}@${params.z}`) return
    const center = map.getCenter()
    if (Math.abs(center.lat - params.c[0]) < 0.01 && Math.abs(center.lng - params.c[1]) < 0.01 && map.getZoom() === params.z) return
    map.setView(params.c, params.z, { animate: !prefersReducedMotion() })
  }, [map, params.c, params.z])

  // Location search: a matching municipality moves the map there; any other
  // text searches all of NIR (decision #33).
  const municipalities = useMunicipalities().data
  const searchedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!map || !params.q || searchedFor.current === params.q) return
    if (!municipalities) return
    searchedFor.current = params.q
    const needle = params.q.toLowerCase()
    const exact = municipalities.find((m) => m.name.toLowerCase() === needle)
    const starts = municipalities.filter((m) => m.name.toLowerCase().startsWith(needle))
    const match = exact ?? (starts.length === 1 ? starts[0] : undefined)
    const animate = !prefersReducedMotion()
    if (match) map.setView(toLatLng(match.point), FOCUS_ZOOM, { animate })
    else map.fitBounds(NIR_BOUNDS, { animate })
  }, [map, params.q, municipalities])

  // Choosing a province in "Area" frames it on the map (25:625).
  const framedArea = useRef(params.c ? params.area : null)
  useEffect(() => {
    if (!map || !municipalities || framedArea.current === params.area) return
    framedArea.current = params.area
    if (!params.area || params.area === 'near') return
    const province = AREA_PROVINCE[params.area]
    const points = municipalities.filter((m) => m.province === province).map((m) => toLatLng(m.point))
    if (points.length) map.fitBounds(latLngBounds(points).pad(0.05), { animate: !prefersReducedMotion() })
  }, [map, municipalities, params.area])

  const locate = () => {
    locateOnce()
      .then(({ lat, lng }) => map?.setView([lat, lng], FOCUS_ZOOM, { animate: !prefersReducedMotion() }))
      .catch(() => toast({ tone: 'warning', title: t('map.locateFailed'), message: t('map.locateFailedBody') }))
  }

  // ── Facilities, demo labels ────────────────────────────────────────────
  const facilities = usePublicCoordinationPoints().data ?? []
  const demo = items.some((r) => r.is_demo)

  const clearAll = () => updateFilters(DEFAULT_FILTERS)
  const resultCount = shown?.meta.total ?? null

  // ── Map chips ──────────────────────────────────────────────────────────
  const total = shown?.meta.total ?? 0
  const selectedReceded = selected && RECEDED_STATUSES.has(selected.status) ? selected.status : null
  const noneWhere = params.area && params.area !== 'near' ? t('map.inArea', { area: t(`filters.areas.${params.area}`) }) : t('map.inView')
  const noneText = params.types.length
    ? t('map.noneInView', { filter: params.types.map(displayBloodType).join(', '), where: noneWhere })
    : t('map.noneInViewPlain', { where: noneWhere })

  const chip = selectedReceded ? (
    <MapChip icon={selectedReceded === 'expired' ? 'hourglass' : 'lock'}>
      {t(selectedReceded === 'expired' ? 'map.expiredHidden' : 'map.closedHidden')}
    </MapChip>
  ) : search.isFetching ? (
    <MapChip icon="loader" spin>
      {t('map.loading')}
    </MapChip>
  ) : shown && total === 0 ? (
    <MapChip>{noneText}</MapChip>
  ) : null

  // ── Layout ─────────────────────────────────────────────────────────────
  const detailsInPanel = params.sel !== null && (isDesktop || !isTablet)
  const detailsAsDrawer = params.sel !== null && isTablet && !isDesktop

  const details = params.sel && (
    <RequestDetailsPanel
      key={params.sel}
      id={params.sel}
      resultCount={resultCount}
      onBack={closeDetails}
      hrefFor={hrefFor}
      onFindNearby={(request) => {
        const [lng, lat] = request.location.point
        update({
          ...DEFAULT_FILTERS,
          types: [request.blood_type],
          sel: null,
          c: [Number(lat.toFixed(2)), Number(lng.toFixed(2))],
          z: 11,
          page: 1,
        })
      }}
    />
  )

  const viewToggle = (!isTablet || params.view === 'list') && (
    <SegmentedControl<View>
      label={t('views.label')}
      value={params.view === 'map' ? 'map' : 'list'}
      onValueChange={(view) => update({ view: view === 'list' ? 'split' : view })}
      segments={[
        { value: 'list', label: t('views.list'), icon: 'list' },
        { value: 'map', label: t('views.map'), icon: 'map' },
      ]}
    />
  )

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <SkipLink href="#explorer-panel" />
      <SiteHeader cta="create" />
      <main id="main" className="relative flex min-h-0 flex-1">
        {(!mapVisible || isTablet) && (
          <section
            id="explorer-panel"
            tabIndex={-1}
            aria-label={t('pageTitle')}
            className={cn(
              'relative flex min-h-0 flex-col border-default bg-surface outline-none',
              mapVisible ? 'w-full shrink-0 border-r md:w-90 lg:w-100 xl:w-110' : 'mx-auto w-full max-w-160 sm:border-x',
            )}
          >
            {/* 2 px progress bar while refreshing with results on screen (55:208). */}
            {search.isFetching && shown && (
              <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-brand-soft">
                <div className="h-full w-1/3 animate-progress bg-brand" />
              </div>
            )}
            {detailsInPanel ? (
              details
            ) : (
              <>
                <div className="border-b border-default">
                  <SearchFilters
                    params={params}
                    updateFilters={updateFilters}
                    onClearAll={clearAll}
                    bbox={mapVisible ? bbox : null}
                    titleAside={
                      viewToggle ||
                      (demo && <DemoBadge>{t('sampleData')}</DemoBadge>)
                    }
                  />
                </div>
                <ResultsPanel
                  items={items}
                  meta={shown?.meta ?? null}
                  initialLoading={initialLoading}
                  stale={stale}
                  failed={failed}
                  lastUpdated={lastGood?.at ?? null}
                  onRetry={() => void search.refetch()}
                  sort={params.sort}
                  nearMe={nearMe}
                  onSortChange={(sort) => update({ sort, page: 1, area: nearMe ? null : params.area })}
                  onPageChange={(page) => {
                    update({ page })
                    document.getElementById('explorer-results')?.scrollTo({ top: 0 })
                  }}
                  onClearAll={clearAll}
                  hrefFor={hrefFor}
                  selectedId={params.sel}
                  highlightedId={highlighted}
                  onHighlight={setHighlighted}
                />
              </>
            )}
          </section>
        )}

        {mapVisible && (
          <div className="relative min-w-0 flex-1">
            <a
              href="#explorer-results"
              className="type-label-m sr-only z-1100 rounded-md bg-surface px-3 py-2 text-primary shadow-overlay focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
            >
              {t('map.skip')}
            </a>
            <RequestMap
              className="size-full"
              label={t('map.label')}
              requests={items}
              facilities={facilities}
              selectedId={params.sel}
              highlightedId={highlighted}
              areaFor={areaFor}
              onHighlight={setHighlighted}
              onSelect={(id) => update({ sel: id })}
              initialView={params.c && params.z !== null ? { center: params.c, zoom: params.z } : null}
              onMapReady={onMapReady}
              onViewChange={onViewChange}
              tileKey={tileKey}
              onTileStatus={(status) => setMapFailed(status === 'failed')}
            >
              {/* Overlays sit above Leaflet panes (z 400–1000). */}
              <div className="pointer-events-none absolute inset-0 z-1000">
                {!isTablet && (
                  <div className="pointer-events-auto absolute top-3 left-3">{viewToggle}</div>
                )}
                {demo && (
                  <DemoBadge className={cn('pointer-events-auto absolute', isTablet ? 'top-4 left-4' : 'top-16 left-3')}>
                    {t('map.demoBadge')}
                  </DemoBadge>
                )}
                <div className="absolute inset-x-0 top-4 flex flex-col items-center gap-2 px-16">
                  {chip && <div className="pointer-events-auto">{chip}</div>}
                  {!autoSearch && pendingBbox && pendingBbox !== bbox && (
                    <Button
                      variant="secondary"
                      icon="search"
                      className="pointer-events-auto shadow-floating"
                      onClick={() => setBbox(pendingBbox)}
                    >
                      {t('map.searchArea')}
                    </Button>
                  )}
                </div>
                <MapControls
                  className="pointer-events-auto absolute top-4 right-4"
                  onZoomIn={() => map?.zoomIn()}
                  onZoomOut={() => map?.zoomOut()}
                  onLocate={locate}
                  onToggleKey={() => setKeyOpen((open) => !open)}
                  keyOpen={keyOpen}
                  canZoomIn={zoom < MAX_ZOOM}
                  canZoomOut={zoom > MIN_ZOOM}
                />
                {keyOpen && <MapKey className="pointer-events-auto absolute bottom-8 left-4 max-sm:hidden" />}
                {mapFailed && (
                  // Map failed to load (17:2258): the list keeps working.
                  <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-canvas/80 p-4">
                    <div className="w-90 max-w-full rounded-lg border border-default bg-surface shadow-overlay">
                      <EmptyState
                        role="alert"
                        tone="warning"
                        icon="map"
                        title={t('states:mapUnavailable.title')}
                        description={t('states:mapUnavailable.body')}
                        actions={
                          <>
                            <Button
                              variant="secondary"
                              icon="refresh"
                              onClick={() => {
                                setMapFailed(false)
                                setTileKey((k) => k + 1)
                              }}
                            >
                              {t('states:mapUnavailable.retry')}
                            </Button>
                            <Button variant="tertiary" onClick={() => update({ view: 'list' })}>
                              {t('states:mapUnavailable.listOnly')}
                            </Button>
                          </>
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </RequestMap>
            {detailsAsDrawer && (
              // Tablet: detail opens as a 400 px drawer over the map (55:281).
              <aside className="absolute inset-y-0 right-0 z-1100 flex w-100 max-w-full flex-col border-l border-default bg-surface shadow-overlay">
                {details}
              </aside>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

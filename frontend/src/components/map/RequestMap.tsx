/// <reference types="leaflet.markercluster" />
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type L from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useTranslation } from 'react-i18next'
import type { PublicCoordinationPoint } from '../../lib/api/requests'
import { cn } from '../../lib/cn'
import { displayBloodType, RECEDED_STATUSES, type PublicRequest } from '../../lib/request'
import { StatusBadge } from '../domain/StatusBadge'
import { icons } from '../ui/icons'
import {
  AREA_MIN_ZOOM,
  AREA_RADIUS_M,
  ATTRIBUTION,
  CLUSTER_RADIUS_PX,
  MAX_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  NIR_BOUNDS,
  TILE_URL,
  toLatLng,
} from './mapConfig'
import { captionIcon, clusterIcon, facilityIcon, requestIcon } from './markerIcons'

const ChevronRight = icons['chevron-right']

export type MapView ={ center: [number, number]; zoom: number; bounds: L.LatLngBounds }

type RequestMapProps = {
  requests: PublicRequest[]
  facilities?: PublicCoordinationPoint[]
  selectedId?: string | null
  highlightedId?: string | null
  /** Shows the approximate area (selected or highlighted request). */
  areaFor?: PublicRequest | null
  onHighlight?: (id: string | null) => void
  onSelect?: (id: string) => void
  /** From the URL (c, z); otherwise the map fits all of NIR. */
  initialView?: { center: [number, number]; zoom: number } | null
  onMapReady?: (map: L.Map) => void
  /** Every moveend (pan, zoom, fly); the caller debounces. */
  onViewChange?: (view: MapView) => void
  /** Retry key: changing it reloads the tile layer. */
  tileKey?: number
  onTileStatus?: (status: 'loaded' | 'failed') => void
  /** Previews (Landing, Auth) are static and keyboard-silent. */
  interactive?: boolean
  label: string
  className?: string
  children?: ReactNode
}

function ViewEvents({ onViewChange }: { onViewChange?: (view: MapView) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onViewChange?.({ center: [c.lat, c.lng], zoom: map.getZoom(), bounds: map.getBounds() })
    },
  })
  return null
}

/** Map Area · Approximate (9:256): only drawn once the circle is big enough to read (zoom ≥ 10). */
function ApproximateArea({ center, caption }: { center: L.LatLngTuple; caption: string }) {
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const [zoom, setZoom] = useState(() => map.getZoom())
  const icon = useMemo(() => captionIcon(caption), [caption])
  if (zoom < AREA_MIN_ZOOM) return null
  return (
    <>
      <Circle center={center} radius={AREA_RADIUS_M} pathOptions={{ className: 'bm-area' }} interactive={false} />
      <Marker
        position={[center[0] - AREA_RADIUS_M / 111_320 + 0.004, center[1]]}
        icon={icon}
        interactive={false}
        keyboard={false}
      />
    </>
  )
}

function RequestMarker({
  request,
  selected,
  highlighted,
  interactive,
  onHighlight,
  onSelect,
}: {
  request: PublicRequest
  selected: boolean
  highlighted: boolean
  interactive: boolean
  onHighlight?: (id: string | null) => void
  onSelect?: (id: string) => void
}) {
  const { t } = useTranslation(['explorer', 'request'])
  const markerRef = useRef<L.Marker>(null)
  const type = displayBloodType(request.blood_type)
  const name = t('explorer:map.marker', {
    type: t(`request:bloodType.spoken.${request.blood_type}`),
    id: request.id,
    city: request.location.municipality,
  })
  const icon = useMemo(() => requestIcon(type, name, selected || highlighted), [type, name, selected, highlighted])

  // Keyboard focus highlights like hover does — not hover-only (55:215).
  useEffect(() => {
    const element = markerRef.current?.getElement()
    if (!element || !interactive) return
    const focus = () => onHighlight?.(request.id)
    const blur = () => onHighlight?.(null)
    element.addEventListener('focus', focus)
    element.addEventListener('blur', blur)
    return () => {
      element.removeEventListener('focus', focus)
      element.removeEventListener('blur', blur)
    }
  }, [interactive, onHighlight, request.id, icon])

  return (
    <Marker
      ref={markerRef}
      position={toLatLng(request.location.point)}
      icon={icon}
      interactive={interactive}
      keyboard={interactive}
      zIndexOffset={selected || highlighted ? 1000 : 0}
      eventHandlers={
        interactive
          ? {
              click: () => onSelect?.(request.id),
              mouseover: () => onHighlight?.(request.id),
              mouseout: () => onHighlight?.(null),
            }
          : undefined
      }
    >
      {highlighted && !selected && (
        <Tooltip permanent direction="top" offset={[0, -40]} className="bm-popup" interactive={false}>
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <span className="type-mono-s text-secondary">{request.id}</span>
              <StatusBadge status={request.status} />
            </span>
            <span className="type-label-m text-primary">
              {type} · {request.location.municipality}
            </span>
            <span className="type-label-s inline-flex items-center gap-0.5 text-link">
              {t('explorer:map.popupDetails')}
              <ChevronRight aria-hidden size={14} />
            </span>
          </span>
        </Tooltip>
      )}
    </Marker>
  )
}

/**
 * Map · Interactive (Leaflet) (14:379). OpenStreetMap tiles, attribution
 * always visible, zoom capped at 13, markers clustered at 48 px. Only
 * municipality centroids are ever plotted for requests.
 */
export function RequestMap({
  requests,
  facilities = [],
  selectedId = null,
  highlightedId = null,
  areaFor = null,
  onHighlight,
  onSelect,
  initialView,
  onMapReady,
  onViewChange,
  tileKey = 0,
  onTileStatus,
  interactive = true,
  label,
  className,
  children,
}: RequestMapProps) {
  const { t } = useTranslation('explorer')
  const loaded = useRef(0)
  const failed = useRef(0)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const mapRef = useCallback(
    (map: L.Map | null) => {
      if (!map) return
      setMapInstance(map)
      onMapReady?.(map)
    },
    [onMapReady],
  )

  // Leaflet only watches the window; keep it in step with its container
  // (layout settling, panel width changes, drawers).
  useEffect(() => {
    const root = rootRef.current
    if (!root || !mapInstance) return
    const observer = new ResizeObserver(() => mapInstance.invalidateSize())
    observer.observe(root)
    return () => observer.disconnect()
  }, [mapInstance])

  useEffect(() => {
    loaded.current = 0
    failed.current = 0
  }, [tileKey])

  const createClusterIcon = useCallback(
    (cluster: L.MarkerCluster) => {
      const count = cluster.getChildCount()
      return clusterIcon(count, t('map.cluster', { count }))
    },
    [t],
  )

  // Expired / closed requests are never drawn on the map (19:2450).
  const live = requests.filter((r) => !RECEDED_STATUSES.has(r.status))
  const area = areaFor && !RECEDED_STATUSES.has(areaFor.status) ? areaFor : null
  const areaCenter = area ? toLatLng(area.location.point) : null
  const selectedRequest =
    live.find((r) => r.id === selectedId) ?? (area && area.id === selectedId ? area : null)

  return (
    <div ref={rootRef} className={cn('relative isolate overflow-hidden', className)} role="region" aria-label={label}>
      <MapContainer
        ref={mapRef}
        className="size-full"
        {...(initialView ? { center: initialView.center, zoom: initialView.zoom } : { bounds: NIR_BOUNDS })}
        // Static previews frame areas precisely; the Explorer keeps whole zooms (z in the URL).
        zoomSnap={interactive ? 1 : 0.25}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={0.8}
        zoomControl={false}
        attributionControl
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
      >
        <TileLayer
          key={tileKey}
          url={TILE_URL}
          attribution={ATTRIBUTION}
          maxZoom={MAX_ZOOM}
          eventHandlers={{
            tileload: () => {
              loaded.current += 1
              if (loaded.current === 1) onTileStatus?.('loaded')
            },
            tileerror: () => {
              failed.current += 1
              // Several failures and nothing loaded = the tile server is unreachable.
              if (failed.current === 4 && loaded.current === 0) onTileStatus?.('failed')
            },
          }}
        />
        <ViewEvents onViewChange={onViewChange} />

        {areaCenter && <ApproximateArea center={areaCenter} caption={t('map.approxArea')} />}

        {facilities.map((facility) => (
          <Marker
            key={facility.id}
            position={toLatLng(facility.point)}
            icon={facilityIcon(t('map.facility', { name: facility.name }))}
            keyboard={interactive}
            interactive={interactive}
          >
            {interactive && (
              <Tooltip direction="top" offset={[34, -40]} className="bm-name">
                {facility.name}
              </Tooltip>
            )}
          </Marker>
        ))}

        <MarkerClusterGroup
          maxClusterRadius={CLUSTER_RADIUS_PX}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          zoomToBoundsOnClick
          iconCreateFunction={createClusterIcon}
        >
          {live.filter((r) => r !== selectedRequest).map((request) => (
            <RequestMarker
              key={request.id}
              request={request}
              selected={request.id === selectedId}
              highlighted={request.id === highlightedId}
              interactive={interactive}
              onHighlight={onHighlight}
              onSelect={onSelect}
            />
          ))}
        </MarkerClusterGroup>

        {/* The selected request never hides inside a cluster (requests share centroids). */}
        {selectedRequest && (
          <RequestMarker
            request={selectedRequest}
            selected
            highlighted={false}
            interactive={interactive}
            onHighlight={onHighlight}
            onSelect={onSelect}
          />
        )}
      </MapContainer>
      {children}
    </div>
  )
}

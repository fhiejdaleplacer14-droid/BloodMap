import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterChip } from '../../components/ui/FilterChip'
import { DateField } from '../../components/ui/DateTimeField'
import { TextField } from '../../components/ui/TextField'
import { icons } from '../../components/ui/icons'
import { useRequestSearch } from '../../lib/api/requests'
import { manilaToday } from '../../lib/dates'
import {
  AREAS,
  DEFAULT_FILTERS,
  hasActiveFilters,
  POSTED_RANGES,
  PUBLIC_STATUSES,
  toSearchQuery,
  type Area,
  type ExplorerFilters,
  type ExplorerParams,
  type PostedRange,
  type PublicStatus,
} from '../../lib/explorer/params'
import { BLOOD_TYPES, displayBloodType, type BloodType } from '../../lib/request'
import { Button } from '../../components/ui/Button'
import { useDebouncedCallback } from '../../lib/hooks'
import { appliedGroupCount, hasStatusChip, useFilterChips } from './filterChips'
import { FilterPopover } from './FilterPopover'
import { FiltersSheet } from './FiltersSheet'

const AlertCircle = icons['alert-circle']

type PopoverName ='type' | 'status' | 'posted' | 'area'

/** "Show 8 requests" — a live count for the draft filters (19:2981). */
function usePreviewCount(draft: ExplorerFilters, bbox: string | null, enabled: boolean) {
  const query = useRequestSearch(toSearchQuery(draft, { bbox }), { enabled })
  return { count: query.data?.meta.total, loading: query.isFetching }
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {children}
    </div>
  )
}

type SearchFiltersProps = {
  params: ExplorerParams
  updateFilters: (patch: Partial<ExplorerFilters>) => void
  onClearAll: () => void
  bbox: string | null
  /** Header slot on the right of the title (sample-data label, view toggle). */
  titleAside?: ReactNode
  /**
   * Phones (25:2): search, "Filters · N" (opens the full-screen sheet) and the
   * List/Map toggle, then a scrollable row of applied chips.
   */
  compact?: boolean
  /** Phone map (25:430): floating search and a filter icon with a dot when filters apply. */
  mapOverlay?: boolean
}

/**
 * Search & filters (14:42): title row, location search, filter triggers
 * (Blood type · Status · Posted · Area) and applied filter chips.
 */
export function SearchFilters({ params, updateFilters, onClearAll, bbox, titleAside, compact = false, mapOverlay = false }: SearchFiltersProps) {
  const { t } = useTranslation(['explorer', 'request'])
  const [open, setOpen] = useState<PopoverName | null>(null)
  const [draft, setDraft] = useState<ExplorerFilters>(DEFAULT_FILTERS)
  const [custom, setCustom] = useState(false)
  const [search, setSearch] = useState(params.q)
  const today = manilaToday()

  // Keep the box in sync with Back/Forward and "Clear all".
  const [syncedQ, setSyncedQ] = useState(params.q)
  if (syncedQ !== params.q) {
    setSyncedQ(params.q)
    setSearch(params.q)
  }

  const commitSearch = useDebouncedCallback((value: string) => {
    if (value.trim() !== params.q) updateFilters({ q: value.trim() })
  }, 400)

  const filters: ExplorerFilters = {
    types: params.types,
    urgency: params.urgency,
    status: params.status,
    posted: params.posted,
    from: params.from,
    to: params.to,
    area: params.area,
    q: params.q,
  }

  const openPopover = (name: PopoverName) => (next: boolean) => {
    if (next) {
      setDraft(filters)
      setCustom(Boolean(filters.from || filters.to))
    }
    setOpen(next ? name : null)
  }

  const preview = usePreviewCount(draft, bbox, open !== null && open !== 'posted')

  const apply = (patch: Partial<ExplorerFilters>) => {
    updateFilters(patch)
    setOpen(null)
  }

  const rangeInvalid = Boolean(
    (draft.from && draft.to && draft.to < draft.from) || (draft.from && draft.from > today) || (draft.to && draft.to > today),
  )

  const statusValue =
    params.status.length === 2 ? t('filters.triggerCount', { count: 2 }) : t(`filters.statuses.${params.status[0]}`)
  const postedValue = params.posted
    ? t(`filters.postedRanges.${params.posted}`)
    : params.from || params.to
      ? t('filters.postedRanges.custom')
      : undefined
  const areaValue = params.area ? t(`filters.areas.${params.area}`) : undefined

  const showLabel = (count: number | undefined) =>
    count === undefined ? t('filters.apply') : t('filters.show', { count })

  const chips = useFilterChips(params, updateFilters)
  const groups = appliedGroupCount(params)

  const searchForm = (label: ReactNode) => (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        updateFilters({ q: search.trim() })
      }}
    >
      <TextField
        type="search"
        label={label}
        placeholder={t('search.placeholder')}
        value={search}
        maxLength={100}
        autoComplete="off"
        onChange={(event) => {
          setSearch(event.target.value)
          commitSearch(event.target.value)
        }}
        onClear={() => {
          setSearch('')
          updateFilters({ q: '' })
        }}
      />
    </form>
  )

  if (mapOverlay) {
    return (
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 rounded-md bg-surface shadow-floating">{searchForm(<span className="sr-only">{t('search.label')}</span>)}</div>
        <FiltersSheet params={params} updateFilters={updateFilters} bbox={bbox}>
          <button
            type="button"
            aria-label={groups ? `${t('filters.label')} ${t('filters.triggerCount', { count: groups })}` : t('filters.label')}
            className="relative flex size-11 shrink-0 items-center justify-center rounded-md border border-default bg-surface text-primary shadow-floating"
          >
            <icons.sliders aria-hidden size={18} />
            {groups > 0 && <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-(--bg-surface) bg-inverse" />}
          </button>
        </FiltersSheet>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-3 px-4 pt-3 pb-3">
        <h1 className="sr-only">{t('pageTitle')}</h1>
        {searchForm(<span className="sr-only">{t('search.label')}</span>)}
        <div className="flex items-center justify-between gap-3">
          <FiltersSheet params={params} updateFilters={updateFilters} bbox={bbox}>
            <Button variant="secondary" icon="sliders">
              {groups ? `${t('filters.label')} ${t('filters.triggerCount', { count: groups })}` : t('filters.label')}
            </Button>
          </FiltersSheet>
          {titleAside}
        </div>
        {chips.length > 0 && (
          <div role="group" aria-label={t('filters.applied')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {chips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.remove} className="shrink-0" />
            ))}
            <button type="button" onClick={onClearAll} className="type-label-m shrink-0 rounded-sm px-1 whitespace-nowrap text-link hover:underline">
              {t('filters.clearAll')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5 max-sm:px-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="type-overline text-tertiary">{t('region')}</p>
          <h1 className="type-h2 text-primary">{t('pageTitle')}</h1>
        </div>
        {titleAside}
      </div>

      {searchForm(t('search.label'))}

      <div role="group" aria-label={t('filters.label')} className="flex flex-wrap gap-2">
        <FilterPopover
          label={t('filters.bloodType')}
          value={t('filters.triggerCount', { count: params.types.length })}
          active={params.types.length > 0}
          open={open === 'type'}
          onOpenChange={openPopover('type')}
          title={t('filters.bloodType')}
          hint={t('filters.bloodTypeHint')}
          onReset={() => setDraft((d) => ({ ...d, types: [] }))}
          onApply={() => apply({ types: draft.types })}
          applyLabel={showLabel(preview.count)}
        >
          <ChipGroup label={t('filters.bloodType')}>
            {BLOOD_TYPES.map((type: BloodType) => (
              <FilterChip
                key={type}
                label={displayBloodType(type)}
                aria-label={t(`request:bloodType.spoken.${type}`)}
                pressed={draft.types.includes(type)}
                onPressedChange={() => setDraft((d) => ({ ...d, types: toggle(d.types, type) }))}
              />
            ))}
          </ChipGroup>
        </FilterPopover>

        <FilterPopover
          label={t('filters.status')}
          value={t('filters.triggerValue', { value: statusValue })}
          active={hasStatusChip(params.status)}
          open={open === 'status'}
          onOpenChange={openPopover('status')}
          title={t('filters.status')}
          onReset={() => setDraft((d) => ({ ...d, status: DEFAULT_FILTERS.status }))}
          onApply={() => apply({ status: draft.status.length ? draft.status : DEFAULT_FILTERS.status })}
          applyLabel={showLabel(preview.count)}
          applyDisabled={draft.status.length === 0}
        >
          <ChipGroup label={t('filters.status')}>
            {PUBLIC_STATUSES.map((status: PublicStatus) => (
              <FilterChip
                key={status}
                label={t(`filters.statuses.${status}`)}
                pressed={draft.status.includes(status)}
                onPressedChange={() => setDraft((d) => ({ ...d, status: toggle(d.status, status) }))}
              />
            ))}
          </ChipGroup>
        </FilterPopover>

        <FilterPopover
          label={t('filters.posted')}
          value={postedValue ? t('filters.triggerValue', { value: postedValue }) : undefined}
          active={Boolean(postedValue)}
          open={open === 'posted'}
          onOpenChange={openPopover('posted')}
          title={t('filters.datePosted')}
          onReset={() => {
            setCustom(false)
            setDraft((d) => ({ ...d, posted: null, from: null, to: null }))
          }}
          onApply={() => apply(custom ? { posted: null, from: draft.from, to: draft.to } : { posted: draft.posted, from: null, to: null })}
          applyLabel={t('filters.apply')}
          applyDisabled={custom && (rangeInvalid || (!draft.from && !draft.to))}
        >
          <div className="flex flex-col gap-3">
            <ChipGroup label={t('filters.datePosted')}>
              {POSTED_RANGES.map((range: PostedRange) => (
                <FilterChip
                  key={range}
                  label={t(`filters.postedRanges.${range}`)}
                  pressed={!custom && draft.posted === range}
                  onPressedChange={(pressed) => {
                    setCustom(false)
                    setDraft((d) => ({ ...d, posted: pressed ? range : null, from: null, to: null }))
                  }}
                />
              ))}
              <FilterChip
                label={t('filters.postedRanges.custom')}
                pressed={custom}
                onPressedChange={(pressed) => {
                  setCustom(pressed)
                  setDraft((d) => ({ ...d, posted: null }))
                }}
              />
            </ChipGroup>
            {custom && (
              <>
                <div className="flex gap-3">
                  <DateField
                    label={t('filters.from')}
                    value={draft.from ?? ''}
                    max={today}
                    onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value || null }))}
                  />
                  <DateField
                    label={t('filters.to')}
                    value={draft.to ?? ''}
                    max={today}
                    aria-invalid={rangeInvalid || undefined}
                    aria-describedby={rangeInvalid ? 'posted-range-error' : undefined}
                    onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value || null }))}
                  />
                </div>
                {rangeInvalid && (
                  <p id="posted-range-error" role="alert" className="type-body-s flex gap-1.5 text-status-critical">
                    <AlertCircle aria-hidden size={14} className="mt-0.5 shrink-0" />
                    {t('filters.rangeError')}
                  </p>
                )}
              </>
            )}
          </div>
        </FilterPopover>

        <FilterPopover
          label={t('filters.area')}
          value={areaValue ? t('filters.triggerValue', { value: areaValue }) : undefined}
          active={params.area !== null}
          open={open === 'area'}
          onOpenChange={openPopover('area')}
          title={t('filters.area')}
          onReset={() => setDraft((d) => ({ ...d, area: null }))}
          onApply={() => apply({ area: draft.area })}
          applyLabel={showLabel(preview.count)}
        >
          <div className="flex flex-col gap-3">
            <ChipGroup label={t('filters.area')}>
              <FilterChip
                label={t('filters.areas.all')}
                pressed={draft.area === null}
                onPressedChange={() => setDraft((d) => ({ ...d, area: null }))}
              />
              {AREAS.map((area: Area) => (
                <FilterChip
                  key={area}
                  label={t(`filters.areas.${area}`)}
                  pressed={draft.area === area}
                  onPressedChange={(pressed) => setDraft((d) => ({ ...d, area: pressed ? area : null }))}
                />
              ))}
            </ChipGroup>
            <p className="type-body-s flex gap-2 text-tertiary">
              <icons.info aria-hidden size={16} className="shrink-0" />
              {t('filters.nearNote')}
            </p>
          </div>
        </FilterPopover>
      </div>

      {(chips.length > 0 || hasActiveFilters(filters)) && (
        <div role="group" aria-label={t('filters.applied')} className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} onRemove={chip.remove} />
          ))}
          <button type="button" onClick={onClearAll} className="type-label-m rounded-sm px-1 text-link hover:underline">
            {t('filters.clearAll')}
          </button>
        </div>
      )}
    </div>
  )
}

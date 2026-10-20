import { useState, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { DateField } from '../../components/ui/DateTimeField'
import { FilterChip } from '../../components/ui/FilterChip'
import { IconButton } from '../../components/ui/IconButton'
import { icons } from '../../components/ui/icons'
import { useRequestSearch } from '../../lib/api/requests'
import { manilaToday } from '../../lib/dates'
import {
  AREAS,
  DEFAULT_FILTERS,
  filtersOf,
  POSTED_RANGES,
  PUBLIC_STATUSES,
  toSearchQuery,
  type ExplorerFilters,
  type ExplorerParams,
} from '../../lib/explorer/params'
import { BLOOD_TYPES, displayBloodType } from '../../lib/request'

const AlertCircle = icons['alert-circle']

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Group({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-label-m text-primary">{title}</h3>
        {aside && <span className="type-body-s text-secondary">{aside}</span>}
      </div>
      <div role="group" aria-label={title} className="flex flex-wrap gap-2">
        {children}
      </div>
    </section>
  )
}

type FiltersSheetProps = {
  params: ExplorerParams
  updateFilters: (patch: Partial<ExplorerFilters>) => void
  bbox: string | null
  /** The button that opens the sheet ("Filters · 2" or the map's filter icon). */
  children: ReactNode
}

/**
 * Mobile / Filters sheet (25:559): every filter group on one full-screen
 * sheet, applied together. "Show N requests" counts the draft live (19:2981);
 * Reset returns the draft to the defaults without closing.
 */
export function FiltersSheet({ params, updateFilters, bbox, children }: FiltersSheetProps) {
  const { t } = useTranslation(['explorer', 'request', 'common'])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ExplorerFilters>(() => filtersOf(params))
  const [custom, setCustom] = useState(false)
  const today = manilaToday()
  const preview = useRequestSearch(toSearchQuery(draft, { bbox }), { enabled: open })
  const count = preview.data?.meta.total

  const rangeInvalid = Boolean((draft.from && draft.to && draft.to < draft.from) || (draft.from && draft.from > today) || (draft.to && draft.to > today))
  const blocked = draft.status.length === 0 || (custom && (rangeInvalid || (!draft.from && !draft.to)))

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(filtersOf(params))
          setCustom(Boolean(params.from || params.to))
        }
        setOpen(next)
      }}
    >
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-1200 flex flex-col bg-surface">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-default pr-2 pl-4">
            <Dialog.Title className="type-h3 text-primary">{t('filters.label')}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon="x" label={t('common:actions.close')} tooltip={false} />
            </Dialog.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            <Group
              title={t('filters.bloodType')}
              aside={draft.types.length ? t('filters.selected', { count: draft.types.length }) : undefined}
            >
              {BLOOD_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  label={displayBloodType(type)}
                  aria-label={t(`request:bloodType.spoken.${type}`)}
                  pressed={draft.types.includes(type)}
                  onPressedChange={() => setDraft((d) => ({ ...d, types: toggle(d.types, type) }))}
                />
              ))}
            </Group>

            <Group title={t('filters.status')}>
              {PUBLIC_STATUSES.map((status) => (
                <FilterChip
                  key={status}
                  label={t(`filters.statuses.${status}`)}
                  pressed={draft.status.includes(status)}
                  onPressedChange={() => setDraft((d) => ({ ...d, status: toggle(d.status, status) }))}
                />
              ))}
            </Group>

            <div className="flex flex-col gap-3">
              <Group title={t('filters.datePosted')}>
                <FilterChip
                  label={t('filters.postedRanges.any')}
                  pressed={!custom && draft.posted === null}
                  onPressedChange={() => {
                    setCustom(false)
                    setDraft((d) => ({ ...d, posted: null, from: null, to: null }))
                  }}
                />
                {POSTED_RANGES.map((range) => (
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
                    setDraft((d) => ({ ...d, posted: null, ...(pressed ? {} : { from: null, to: null }) }))
                  }}
                />
              </Group>
              {custom && (
                <>
                  <div className="grid grid-cols-2 gap-3">
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
                      aria-describedby={rangeInvalid ? 'sheet-range-error' : undefined}
                      onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value || null }))}
                    />
                  </div>
                  {rangeInvalid && (
                    <p id="sheet-range-error" role="alert" className="type-body-s flex gap-1.5 text-status-critical">
                      <AlertCircle aria-hidden size={14} className="mt-0.5 shrink-0" />
                      {t('filters.rangeError')}
                    </p>
                  )}
                </>
              )}
            </div>

            <Group title={t('filters.area')}>
              <FilterChip label={t('filters.areas.all')} pressed={draft.area === null} onPressedChange={() => setDraft((d) => ({ ...d, area: null }))} />
              {AREAS.map((area) => (
                <FilterChip
                  key={area}
                  label={t(`filters.areas.${area}`)}
                  pressed={draft.area === area}
                  onPressedChange={(pressed) => setDraft((d) => ({ ...d, area: pressed ? area : null }))}
                />
              ))}
            </Group>

            <p className="type-body-s flex gap-2 text-secondary">
              <icons.info aria-hidden size={16} className="mt-px shrink-0" />
              {t('filters.nearNote')}
            </p>
          </div>

          <div className="flex shrink-0 gap-3 border-t border-default bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              variant="secondary"
              onClick={() => {
                setCustom(false)
                setDraft({ ...DEFAULT_FILTERS, q: draft.q })
              }}
            >
              {t('filters.reset')}
            </Button>
            <div className="flex-1">
              <Button
                variant="primary"
                className="w-full"
                disabled={blocked}
                loading={preview.isFetching && count === undefined}
                onClick={() => {
                  updateFilters(custom ? { ...draft, posted: null } : { ...draft, from: null, to: null })
                  setOpen(false)
                }}
              >
                {count === undefined ? t('filters.apply') : t('filters.show', { count })}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

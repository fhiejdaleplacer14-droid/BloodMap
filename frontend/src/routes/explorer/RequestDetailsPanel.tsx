import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { Freshness } from '../../components/domain/Freshness'
import { RequestCard } from '../../components/domain/RequestCard'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { UrgencyTag } from '../../components/domain/UrgencyTag'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconButton } from '../../components/ui/IconButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { icons } from '../../components/ui/icons'
import { toast } from '../../components/ui/toast'
import { useMe } from '../../lib/api/auth'
import { errorStatus } from '../../lib/api/client'
import { useRequestDetail, useRequestSearch, useToggleSaved } from '../../lib/api/requests'
import { devicePrefs } from '../../lib/devicePrefs'
import {
  elapsedSince,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatShortDateTime,
  formatTime,
  remainingUntil,
} from '../../lib/datetime'
import { displayBloodType, type PublicRequest } from '../../lib/request'
import { ReportDialog } from './ReportDialog'

const ArrowLeft = icons['arrow-left']
const MapPin = icons['map-pin']
const ShieldCheck = icons['shield-check']
const ExternalLink = icons['external-link']

type RequestDetailsPanelProps = {
  id: string
  resultCount: number | null
  onBack: () => void
  hrefFor: (id: string) => string
  /** "Find active requests nearby": same type around this request's area. */
  onFindNearby: (request: PublicRequest) => void
  /** Phones (25:657): icon back, "Request details" title, sticky Save + Log in for contact. */
  compact?: boolean
}

function Fact({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-default px-3.5 py-2.5 last:border-b-0">
      <dt className="type-body-s w-32 shrink-0 text-secondary">{label}</dt>
      <dd className={mono ? 'type-mono-m min-w-0 flex-1 text-primary' : 'type-label-m min-w-0 flex-1 text-primary'}>{children}</dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6 p-6">
      <div className="flex gap-4">
        <Skeleton className="size-13 rounded-md" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3 w-60 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}

/** "Active O+ requests nearby" for expired / closed requests (19:2284). */
function NearbyActive({ request, hrefFor }: { request: PublicRequest; hrefFor: (id: string) => string }) {
  const { t } = useTranslation('explorer')
  const [lng, lat] = request.location.point
  const query = useRequestSearch({
    blood_type: [request.blood_type],
    bbox: [lng - 0.35, lat - 0.35, lng + 0.35, lat + 0.35].map((n) => n.toFixed(2)).join(','),
  })
  const nearby = (query.data?.data ?? []).filter((r) => r.id !== request.id).slice(0, 2)
  if (nearby.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h3 className="type-h4 text-primary">{t('detail.nearby', { type: displayBloodType(request.blood_type) })}</h3>
      {nearby.map((r) => (
        <RequestCard key={r.id} request={r} to={hrefFor(r.id)} />
      ))}
    </section>
  )
}

/**
 * Panel · Request details (15:475) with the Expired (19:2059) and Closed
 * (19:2457) states. A request that expires while open swaps state in place —
 * never removed silently, never shown as active (55:241).
 */
export function RequestDetailsPanel({ id, resultCount, onBack, hrefFor, onFindNearby, compact = false }: RequestDetailsPanelProps) {
  const { t, i18n } = useTranslation(['explorer', 'request', 'states', 'common'])
  const locale = i18n.language
  const navigate = useNavigate()
  const location = useLocation()
  const { data: me } = useMe()
  const detail = useRequestDetail(id)
  const toggleSaved = useToggleSaved(id)
  const [reporting, setReporting] = useState(false)
  const request = detail.data
  const loadedId = request?.id

  // "Recently viewed" stays in this browser only (29:1153).
  useEffect(() => {
    if (loadedId) devicePrefs.recordView(loadedId)
  }, [loadedId])

  const backLabel =
    resultCount === null ? t('detail.backToRequests') : t('detail.backToResults', { count: resultCount })
  const loginHref = `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`

  const topBar = (actions?: ReactNode) =>
    compact ? (
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-default bg-surface px-2">
        <IconButton icon="arrow-left" label={backLabel} tooltip={false} onClick={onBack} />
        <p className="type-h4 min-w-0 flex-1 truncate text-primary">{t('detail.mobileTitle')}</p>
        {actions}
      </div>
    ) : (
    <div className="flex items-center justify-between gap-2 border-b border-default px-4 py-3">
      <Button variant="tertiary" onClick={onBack} className="-ml-1">
        <ArrowLeft aria-hidden size={16} />
        {backLabel}
      </Button>
      <div className="flex gap-2">{actions}</div>
    </div>
    )

  if (detail.isPending && !request) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
        {topBar()}
        <DetailSkeleton />
      </div>
    )
  }

  if (!request) {
    const notFound = errorStatus(detail.error) === 404
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topBar()}
        {notFound ? (
          <EmptyState
            icon="search"
            title={t('detail.notFound.title')}
            description={t('detail.notFound.body')}
            actions={
              <Button variant="secondary" onClick={onBack}>
                {t('detail.notFound.action')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            role="alert"
            tone="critical"
            icon="wifi-off"
            title={t('states:networkError.title')}
            description={t('states:networkError.body')}
            actions={
              <Button variant="secondary" icon="refresh" onClick={() => void detail.refetch()}>
                {t('states:networkError.action')}
              </Button>
            }
          />
        )}
      </div>
    )
  }

  const expired = request.status === 'expired'
  const closed = request.status === 'closed'
  const receded = expired || closed
  const live = request.status === 'active'
  const type = displayBloodType(request.blood_type)

  const save = (next: boolean) => {
    if (!me) {
      navigate(loginHref)
      return
    }
    toggleSaved.mutate(next, {
      onSuccess: (saved) =>
        toast(
          saved
            ? { tone: 'success', title: t('detail.savedToast'), message: t('detail.savedToastBody') }
            : { tone: 'info', title: t('detail.removedToast') },
        ),
      onError: () => toast({ tone: 'error', title: t('detail.saveFailed'), message: t('detail.saveFailedBody') }),
    })
  }

  // Receded requests can only be removed from saved — never newly saved (55:243).
  const canToggleSave = request.is_saved || !receded
  const saveLabel = request.is_saved ? t('detail.removeSaved') : t('detail.save')

  const updatedAgo = elapsedSince(request.updated_at)
  const expiresIn = request.expires_at ? remainingUntil(request.expires_at) : null
  const directions = `https://www.openstreetmap.org/search?query=${encodeURIComponent(
    `${request.coordination_point.name}, ${request.location.municipality}, ${request.location.province}`,
  )}`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {topBar(
        canToggleSave && (
          <IconButton
            icon="bookmark"
            variant={compact ? undefined : 'outline'}
            label={saveLabel}
            aria-pressed={request.is_saved}
            disabled={toggleSaved.isPending}
            onClick={() => save(!request.is_saved)}
            className={request.is_saved ? 'text-primary [&_svg]:fill-current' : undefined}
          />
        ),
      )}

      <article aria-labelledby="request-detail-title" className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 max-sm:px-4">
        <header className="flex gap-4">
          <BloodTypeTag type={request.blood_type} dimmed={receded} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="type-mono-m text-secondary">{request.id}</p>
            <h2 id="request-detail-title" className="type-h2 text-primary">
              {t('detail.title', { type })}
            </h2>
            <p className="type-body-m flex items-center gap-1 text-secondary">
              <MapPin aria-hidden size={16} className="shrink-0" />
              {request.location.municipality}, {request.location.province}
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          {!receded && <UrgencyTag urgency={request.urgency} />}
          <Freshness updatedAt={request.updated_at} level={receded ? 'stale' : undefined} />
        </div>

        {expired && request.expires_at ? (
          <div className="flex gap-2.5 rounded-md border border-strong bg-status-neutral p-3.5 text-status-neutral">
            <icons.hourglass aria-hidden size={18} className="mt-px shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="type-label-m">{t('detail.expired.title')}</p>
              <p className="type-body-s">
                {t('detail.expired.body', {
                  date: formatDate(request.expires_at, locale),
                  time: formatTime(request.expires_at, locale),
                })}
              </p>
            </div>
          </div>
        ) : closed ? (
          <div className="flex gap-2.5 rounded-md border border-strong bg-status-neutral p-3.5 text-status-neutral">
            <icons.lock aria-hidden size={18} className="mt-px shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="type-label-m">{t('detail.closed.title')}</p>
              <p className="type-body-s">{t('detail.closed.body', { date: formatDate(request.updated_at, locale) })}</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-2.5 rounded-md bg-status-info px-3.5 py-3 text-status-info">
            <icons.info aria-hidden size={18} className="mt-px shrink-0" />
            <p className="type-body-s">{t('detail.notice')}</p>
          </div>
        )}

        <dl aria-label={t('detail.facts.label')} className="flex flex-col rounded-lg border border-default">
          <Fact label={t('detail.facts.bloodType')}>
            {t('detail.facts.bloodTypeValue', { type, spoken: t(`request:bloodType.spoken.${request.blood_type}`) })}
          </Fact>
          {request.units_requested !== null && (
            <Fact label={t('detail.facts.units')}>{t('detail.facts.unitsValue', { count: request.units_requested })}</Fact>
          )}
          {request.needed_by && (
            <Fact label={t('detail.facts.neededBy')} mono>
              {formatCalendarDate(request.needed_by, locale)}
            </Fact>
          )}
          <Fact label={t('detail.facts.location')}>
            {request.location.municipality}, {request.location.province}
          </Fact>
          {request.published_at && (
            <Fact label={t('detail.facts.posted')} mono>
              <time dateTime={request.published_at}>{formatDateTime(request.published_at, locale)}</time>
            </Fact>
          )}
          <Fact label={t('detail.facts.updated')} mono>
            <time dateTime={request.updated_at}>
              {formatShortDateTime(request.updated_at, locale)} ·{' '}
              {t(`common:time.ago.${updatedAgo.unit}`, { count: updatedAgo.count })}
            </time>
          </Fact>
          {request.expires_at && (
            <Fact label={t('detail.facts.expires')} mono>
              <time dateTime={request.expires_at}>
                {formatShortDateTime(request.expires_at, locale)}
                {expiresIn && <> · {t(`relative.in.${expiresIn.unit}`, { count: expiresIn.count })}</>}
              </time>
            </Fact>
          )}
        </dl>

        {!receded && (
          <section className="flex flex-col gap-3">
            <h3 className="type-h4 text-primary">{t('detail.respond.title')}</h3>
            <ol className="flex flex-col gap-3">
              {[t('detail.respond.step1'), t('detail.respond.step2', { id: request.id }), t('detail.respond.step3')].map(
                (step, index) => (
                  <li key={index} className="flex gap-3">
                    <span
                      aria-hidden
                      className="type-label-s flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-secondary"
                    >
                      {index + 1}
                    </span>
                    <span className="type-body-m text-primary">{step}</span>
                  </li>
                ),
              )}
            </ol>
            {request.response_instructions && (
              <p className="type-body-m text-secondary">{request.response_instructions}</p>
            )}
          </section>
        )}

        {!receded && (
          <section
            aria-labelledby="coordination-point-name"
            className="flex flex-col gap-3 rounded-lg border border-default bg-canvas p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-default bg-surface text-primary">
                <icons.building aria-hidden size={20} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="type-overline text-tertiary">{t('detail.point.eyebrow')}</p>
                <h3 id="coordination-point-name" className="type-label-m text-primary">
                  {request.coordination_point.name}
                </h3>
              </div>
            </div>
            {request.coordination_point.hours && (
              <p className="type-mono-s flex items-center gap-1.5 text-secondary">
                <icons.clock aria-hidden size={16} className="shrink-0" />
                {t('detail.point.hours', { hours: request.coordination_point.hours })}
              </p>
            )}
            {request.contact ? (
              <p className="type-body-m flex items-center gap-1.5 text-primary">
                {request.contact.method === 'phone' ? (
                  <icons.phone aria-hidden size={16} className="shrink-0 text-secondary" />
                ) : (
                  <icons.mail aria-hidden size={16} className="shrink-0 text-secondary" />
                )}
                {request.contact.masked ? (
                  <span className="type-mono-m">{request.contact.value}</span>
                ) : (
                  <a
                    href={`${request.contact.method === 'phone' ? 'tel:' : 'mailto:'}${request.contact.value.replace(/\s/g, '')}`}
                    aria-label={t(request.contact.method === 'phone' ? 'detail.point.call' : 'detail.point.email', {
                      value: request.contact.value,
                    })}
                    className="type-mono-m text-link hover:underline"
                  >
                    {request.contact.value}
                  </a>
                )}
              </p>
            ) : (
              !me &&
              live && (
                <p className="type-body-s flex items-center gap-1.5 text-secondary">
                  <icons.lock aria-hidden size={16} className="shrink-0" />
                  {t('detail.point.gated')}
                </p>
              )
            )}
            <div className="flex flex-wrap gap-2">
              {!request.contact && !me && live && (
                <Button asChild variant="secondary">
                  <Link to={loginHref}>{t('detail.point.logIn')}</Link>
                </Button>
              )}
              <Button asChild variant="tertiary">
                <a href={directions} target="_blank" rel="noreferrer noopener">
                  <icons.navigation aria-hidden size={16} />
                  {t('detail.point.directions')}
                  <ExternalLink aria-hidden size={14} className="text-secondary" />
                </a>
              </Button>
            </div>
          </section>
        )}

        {request.published_at && (
          <p className="type-body-s flex gap-2 text-tertiary">
            <ShieldCheck aria-hidden size={16} className="mt-px shrink-0" />
            {t('detail.reviewNote', { when: formatDateTime(request.published_at, locale) })}
          </p>
        )}

        {request.can.report && (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="type-label-s inline-flex w-fit items-center gap-1.5 rounded-sm text-secondary hover:text-primary hover:underline"
          >
            <icons.flag aria-hidden size={14} />
            {t('detail.report.open')}
          </button>
        )}

        {receded && <NearbyActive request={request} hrefFor={hrefFor} />}
      </article>
      {request.can.report && <ReportDialog requestId={request.id} open={reporting} onOpenChange={setReporting} />}

      <div className="flex items-center gap-2 border-t border-default bg-surface px-6 py-4 max-sm:px-4">
        {receded ? (
          <>
            <Button variant="primary" icon="search" className="flex-1" onClick={() => onFindNearby(request)}>
              {t('detail.findNearby')}
            </Button>
            {request.is_saved && (
              <Button variant="secondary" icon="bookmark" loading={toggleSaved.isPending} onClick={() => save(false)}>
                {t('detail.removeSaved')}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              variant={request.is_saved ? 'secondary' : 'primary'}
              icon="bookmark"
              className="flex-1"
              aria-pressed={request.is_saved}
              loading={toggleSaved.isPending}
              onClick={() => save(!request.is_saved)}
            >
              {saveLabel}
            </Button>
            {compact && !me && !request.contact && live && (
              <Button asChild variant="secondary">
                <Link to={loginHref}>{t('detail.point.logInShort')}</Link>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

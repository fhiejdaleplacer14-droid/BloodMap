import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { UrgencyTag } from '../../components/domain/UrgencyTag'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons, type IconName } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { errorStatus } from '../../lib/api/client'
import { useManagedRequest, useRequestHistory, type HistoryEvent, type ManagedRequest } from '../../lib/api/myRequests'
import { formatCalendarDate, formatDateTime, formatShortDateTime, remainingUntil } from '../../lib/datetime'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { CloseRequestDialog } from './CloseRequestDialog'
import { useOwnerActions } from './ownerActions'
import { EDITABLE_IN_WIZARD, wizardHref } from './requestForm'

const HISTORY_ICONS: Record<string, IconName> = {
  'request.created': 'file-text',
  'request.submitted': 'send',
  'request.resubmitted': 'refresh',
  'request.correction_requested': 'message',
  'request.approved': 'shield-check',
  'request.rejected': 'ban',
  'request.assigned': 'user',
  'request.edited': 'pencil',
  'request.edited_material': 'pencil',
  'request.extended': 'calendar',
  'request.fulfilled': 'check-circle',
  'request.closed': 'lock',
  'request.expired': 'hourglass',
  'request.contact_revealed': 'eye',
}

/** Requests / Request detail — Owner view with history (32:1815). */
export function OwnerDetailPage() {
  const { t } = useTranslation(['manage', 'states'])
  const { id = '' } = useParams()
  const request = useManagedRequest(id)
  useDocumentTitle(id)

  if (request.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-5 p-8 max-sm:p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96 max-w-full" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }
  if (request.isError) {
    const missing = errorStatus(request.error) === 404
    return (
      <div className="p-8 max-sm:p-4">
        <EmptyState
          role={missing ? undefined : 'alert'}
          tone={missing ? undefined : 'critical'}
          icon={missing ? 'search' : 'wifi-off'}
          title={missing ? t('detail.notFound') : t('states:networkError.title')}
          description={missing ? t('detail.notFoundBody') : t('states:networkError.body')}
          actions={
            missing ? (
              <Button asChild variant="secondary">
                <Link to="/requests/mine">{t('detail.back')}</Link>
              </Button>
            ) : (
              <Button variant="secondary" icon="refresh" onClick={() => void request.refetch()}>
                {t('states:networkError.action')}
              </Button>
            )
          }
        />
      </div>
    )
  }

  return <Detail request={request.data} />
}

function Detail({ request: r }: { request: ManagedRequest }) {
  const { t, i18n } = useTranslation(['manage', 'request'])
  const locale = i18n.language
  const { run, closeDialog, pending } = useOwnerActions()
  const live = r.status === 'active' || r.status === 'pending_review'

  const neededBy = r.needed_by
    ? r.desk_window
      ? t('review.neededByValue', { date: formatCalendarDate(r.needed_by, locale), from: r.desk_window[0], to: r.desk_window[1] })
      : formatCalendarDate(r.needed_by, locale)
    : t('review.notSet')
  const remaining = r.expires_at ? remainingUntil(r.expires_at) : null
  const expires = r.expires_at
    ? remaining
      ? t('detail.expiresIn', { when: formatDateTime(r.expires_at, locale), relative: t(`detail.relative.${remaining.unit}`, { count: remaining.count }) })
      : formatDateTime(r.expires_at, locale)
    : t('detail.notYet')

  const facts: [string, ReactNode][] = [
    [t('fields.units'), r.units_requested ?? t('review.notSet')],
    [t('fields.neededBy'), neededBy],
    [t('fields.category'), r.category ? t(`options.category.${r.category}` as 'options.category.scheduled_procedure') : t('review.notSet')],
    [t('pointPanel.title'), r.coordination_point.name],
    [
      t('detail.contactVisibility'),
      r.contact_method === 'none' ? t('options.contactShort.none') : t(`options.visibilityFact.${r.contact_visible_to}`),
    ],
    [t('detail.publicDescription'), r.public_summary || t('review.notSet')],
    ...(r.response_instructions ? [[t('detail.instructions'), r.response_instructions] as [string, ReactNode]] : []),
    [t('review.expires'), expires],
  ]

  const note =
    r.status === 'needs_correction' && r.correction_note
      ? { title: t('detail.correction'), body: r.correction_note, tone: 'warning' as const }
      : r.status === 'rejected' && r.rejection_reason
        ? { title: t('detail.rejected'), body: r.rejection_reason, tone: 'neutral' as const }
        : r.status === 'closed' && r.closure_reason
          ? { title: t('detail.closedReason'), body: r.closure_reason, tone: 'neutral' as const }
          : null

  return (
    <div className="flex flex-col gap-5 p-8 max-sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="type-h1 text-primary">{r.id}</h1>
        <div className="flex flex-wrap gap-2">
          {EDITABLE_IN_WIZARD.has(r.status) && r.can.update && (
            <Button asChild variant="primary">
              <Link to={wizardHref(r)}>
                <icons.pencil aria-hidden size={16} />
                {r.status === 'draft' ? t('actions.continueDraft') : t('actions.edit')}
              </Link>
            </Button>
          )}
          {r.can.extend && (
            <Button variant="secondary" icon="calendar" disabled={pending} onClick={() => run.extend(r)}>
              {t('actions.extend')}
            </Button>
          )}
          {r.can.fulfill && (
            <Button variant="secondary" icon="check-circle" disabled={pending} onClick={() => run.fulfill(r)}>
              {t('actions.fulfill')}
            </Button>
          )}
          {r.can.close && (
            <Button variant="destructive" icon="trash" onClick={() => run.close(r)}>
              {t('actions.close')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <BloodTypeTag type={r.blood_type} size="sm" />
        <span className="type-body-m text-secondary">
          {r.location.municipality}, {r.location.province}
        </span>
        <StatusBadge status={r.status} />
        {live && <UrgencyTag urgency={r.urgency} />}
      </div>

      {note && (
        <div
          role="note"
          className={`flex gap-2 rounded-lg px-4 py-3 ${note.tone === 'warning' ? 'bg-status-warning text-status-warning' : 'bg-subtle text-primary'}`}
        >
          <icons.message aria-hidden size={18} className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="type-label-m">{note.title}</p>
            <p className="type-body-m">“{note.body}”</p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="overflow-hidden rounded-xl border border-default bg-surface">
          <h2 className="type-h4 border-b border-default px-5 py-4 text-primary">
            {r.published_at ? t('detail.published') : t('detail.details')}
          </h2>
          <dl>
            {facts.map(([label, value]) => (
              <div key={label} className="flex gap-4 border-b border-default px-5 py-3 last:border-b-0 max-sm:flex-col max-sm:gap-1">
                <dt className="type-body-s w-42.5 shrink-0 pt-px text-secondary">{label}</dt>
                <dd className="type-body-m min-w-0 flex-1 break-words text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <History id={r.id} />
      </div>
      <CloseRequestDialog {...closeDialog} />
    </div>
  )
}

function History({ id }: { id: string }) {
  const { t, i18n } = useTranslation(['manage', 'states'])
  const history = useRequestHistory(id)
  const locale = i18n.language

  const noteFor = (event: HistoryEvent): { text: string; quote?: boolean } | null => {
    switch (event.action) {
      case 'request.correction_requested':
      case 'request.rejected':
      case 'request.closed':
        return event.reason ? { text: event.reason, quote: true } : null
      case 'request.fulfilled':
        return event.reason ? { text: event.reason } : null
      case 'request.approved':
        return { text: t('history.approvedNote') }
      case 'request.extended':
        return event.to ? { text: t('history.extendedTo', { when: formatShortDateTime(event.to, locale) }) } : null
      case 'request.resubmitted':
      case 'request.edited':
      case 'request.edited_material': {
        const fields = [...new Set(event.fields.map((field) => t(`fieldNames.${field}` as 'fieldNames.blood_type', { defaultValue: field })))]
        return fields.length ? { text: t('history.changed', { fields: fields.join(', ') }) } : null
      }
      default:
        return null
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-default bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-default px-5 py-4">
        <h2 className="type-h4 text-primary">{t('detail.history')}</h2>
        <p className="type-body-s text-tertiary">{t('detail.historyNote')}</p>
      </div>
      <div className="px-5 py-4">
        {history.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : history.isError ? (
          <div role="alert" className="flex items-center justify-between gap-3">
            <p className="type-body-m text-status-critical">{t('detail.historyFailed')}</p>
            <Button variant="secondary" icon="refresh" onClick={() => void history.refetch()}>
              {t('states:networkError.action')}
            </Button>
          </div>
        ) : history.data.length === 0 ? (
          <p className="type-body-m text-secondary">{t('detail.historyEmpty')}</p>
        ) : (
          <ol className="flex flex-col">
            {history.data.map((event, index) => {
              const Icon = icons[HISTORY_ICONS[event.action] ?? 'circle-dot']
              const last = index === history.data.length - 1
              const note = noteFor(event)
              const title = t(`history.${event.action}` as 'history.other', { defaultValue: t('history.other') })
              return (
                <li key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-secondary">
                      <Icon aria-hidden size={14} />
                    </span>
                    {!last && <span aria-hidden className="min-h-3 w-0.5 flex-1 bg-line" />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-3.5">
                    <p className="type-label-m text-primary">{title}</p>
                    <p className="type-mono-s text-tertiary">
                      {event.actor ? event.actor.name : t('history.system')} ·{' '}
                      <time dateTime={event.created_at}>{formatShortDateTime(event.created_at, locale)}</time>
                    </p>
                    {note && (
                      <p className={`type-body-s mt-1 rounded-md bg-canvas px-2.5 py-2 text-secondary ${note.quote ? 'italic' : ''}`}>
                        {note.quote ? `“${note.text}”` : note.text}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

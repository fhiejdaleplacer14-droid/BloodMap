import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/toast'
import { errorStatus } from '../../lib/api/client'
import { useReviewAction, useReviewHistory } from '../../lib/api/coordinator'
import { useManagedRequest, type ManagedRequest } from '../../lib/api/myRequests'
import { cn } from '../../lib/cn'
import { formatCalendarDate, formatShortDateTime } from '../../lib/datetime'
import { displayBloodType } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { MobilePageHeader } from '../../components/layout/MobilePageHeader'
import { Tab, Tabs, TabsContent, TabsList } from '../../components/ui/Tabs'
import { useMinWidth } from '../../lib/hooks'
import { CloseRequestDialog } from '../requests/CloseRequestDialog'
import { useOwnerActions } from '../requests/ownerActions'
import { AreaMap, PreviewCard, type PreviewData } from '../requests/WizardParts'
import { durationLabel } from './coordText'

const ArrowLeft = icons['arrow-left']
const AlertTriangle = icons['alert-triangle']
const CheckCircle = icons['check-circle']
const ShieldCheck = icons['shield-check']

/** Same shapes the server's DescriptionScreener flags as phone numbers. */
const PHONE = /(\+?63[\s-]?9\d{2}|\b09\d{2})[\s-]?\d{3}[\s-]?\d{4}\b|\(?0\d{2,3}\)?[\s-]?\d{3}[\s-]?\d{4}\b|\b\d{7,}\b/g

/** Mark and mask possible phone numbers: "09•• ••• ••••" (36:498). Reviewers never need the digits. */
function withMaskedPhones(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(PHONE)) {
    const start = match.index ?? 0
    parts.push(text.slice(last, start))
    const masked = match[0].slice(0, 2) + match[0].slice(2).replace(/\d/g, '•')
    parts.push(
      <mark key={start} className="bg-transparent text-status-warning underline decoration-dotted underline-offset-2">
        {masked}
      </mark>,
    )
    last = start + match[0].length
  }
  parts.push(text.slice(last))
  return parts
}

/** Coordinator / Review Detail (36:498) — and the read-only view of any request in the area. */
export function ReviewPage() {
  const { t } = useTranslation(['coord', 'manage', 'states'])
  const { id = '' } = useParams()
  const request = useManagedRequest(id)
  useDocumentTitle(t('review.title', { id }))

  if (request.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-5 p-8 max-sm:p-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-14 w-96 max-w-full" />
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <Skeleton className="h-120 rounded-xl" />
          <Skeleton className="h-120 rounded-xl" />
          <Skeleton className="h-120 rounded-xl" />
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
          title={missing ? t('manage:detail.notFound') : t('states:networkError.title')}
          description={missing ? t('manage:detail.notFoundBody') : t('states:networkError.body')}
          actions={
            missing ? (
              <Button asChild variant="secondary">
                <Link to="/coord/queue">{t('review.back')}</Link>
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
  return <Review request={request.data} onRefresh={() => void request.refetch()} />
}

function Review({ request: r, onRefresh }: { request: ManagedRequest; onRefresh: () => void }) {
  const { t, i18n } = useTranslation(['coord', 'manage', 'request'])
  const locale = i18n.language
  const navigate = useNavigate()
  const action = useReviewAction()
  const owner = useOwnerActions()
  const [dialog, setDialog] = useState<'correction' | 'reject' | null>(null)
  const [now] = useState(() => new Date())
  const wide = useMinWidth('lg')

  const pending = r.status === 'pending_review'
  const assigned = r.assigned_coordinator
  const elsewhere = assigned !== null && !assigned.is_me
  const canDecide = pending && Boolean(r.can.approve) && !elsewhere
  const submittedAt = r.submitted_at ?? r.created_at
  const submitter = r.submitter?.reference ? t('queue.submitter', { reference: r.submitter.reference }) : t('review.submitterFallback')
  const flags = r.checks?.flags ?? []

  const run = (kind: 'assign' | 'approve' | 'request-correction' | 'reject', reason?: string) =>
    action.mutate(
      { id: r.id, action: kind, reason },
      {
        onSuccess: (updated) => {
          setDialog(null)
          if (kind === 'assign') return toast({ tone: 'success', title: t('queue.assigned'), message: t('queue.assignedBody', { id: updated.id }) })
          const done = {
            approve: [t('review.approved'), t('review.approvedBody', { id: updated.id })],
            'request-correction': [t('review.corrected'), t('review.correctedBody', { id: updated.id })],
            reject: [t('review.rejected'), t('review.rejectedBody', { id: updated.id })],
          }[kind]
          toast({ tone: 'success', title: done[0], message: done[1] })
          navigate('/coord/queue?tab=mine')
        },
        onError: (error) => {
          setDialog(null)
          if (errorStatus(error) === 409) {
            toast({ tone: 'error', title: t('review.conflict'), message: t('review.conflictBody') })
            onRefresh()
          } else toast({ tone: 'error', title: t('review.failed'), message: t('review.failedBody') })
        },
      },
    )

  const preview: PreviewData = {
    blood_type: r.blood_type,
    municipality: r.location.municipality,
    province: r.location.province,
    point: r.location.point,
    summary: r.public_summary ?? '',
    urgency: r.urgency,
    expiresAt: r.expires_at,
    status: r.status,
    contactMethod: r.contact_method,
    contactVisibleTo: r.contact_visible_to,
  }

  const facts: [string, ReactNode][] = [
    [t('manage:fields.bloodType'), displayBloodType(r.blood_type)],
    [t('manage:fields.units'), r.units_requested ?? t('manage:review.notSet')],
    [t('manage:fields.neededBy'), r.needed_by ? formatCalendarDate(r.needed_by, locale) : t('manage:review.notSet')],
    [
      t('manage:fields.deskWindow'),
      r.desk_window ? (
        `${r.desk_window[0]}–${r.desk_window[1]}`
      ) : (
        <span key="desk" className="inline-flex flex-wrap items-center gap-2 text-status-warning">
          {t('review.notProvided')}
          <span className="type-label-s inline-flex items-center gap-1 rounded-sm bg-status-warning px-1.5 py-0.5">
            <AlertTriangle aria-hidden size={12} />
            {t('review.missing')}
          </span>
        </span>
      ),
    ],
    [t('manage:review.location'), `${r.location.municipality}, ${r.location.province}`],
    [t('manage:fields.category'), r.category ? t(`manage:options.category.${r.category}` as 'manage:options.category.scheduled_procedure') : t('manage:review.notSet')],
    [t('manage:pointPanel.title'), r.coordination_point.name],
    [
      t('manage:detail.contactVisibility'),
      r.contact_method === 'none' ? t('manage:options.contactShort.none') : t(`manage:options.visibilityFact.${r.contact_visible_to}`),
    ],
  ]

  const submittedSection = (
          <section className="overflow-hidden rounded-xl border border-default bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-default px-4 py-3.5">
              <h2 className="type-h4 text-primary">{t('review.submitted')}</h2>
              <span className="type-body-s text-tertiary">{t('review.asEntered')}</span>
            </div>
            <dl className="flex flex-col px-4 py-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex gap-3 py-2.5">
                  <dt className="type-body-s w-26 shrink-0 pt-px text-secondary">{label}</dt>
                  <dd className="type-body-m min-w-0 flex-1 text-primary">{value}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-2 py-2.5">
                <dt className="type-body-s text-secondary">{t('manage:detail.publicDescription')}</dt>
                <dd className="type-body-m rounded-md border border-default bg-canvas px-3 py-2 break-words text-primary">
                  {r.public_summary ? withMaskedPhones(r.public_summary) : t('manage:review.notSet')}
                </dd>
                {flags.includes('possible_phone_number') && (
                  <dd className="type-body-s flex gap-1.5 text-status-warning">
                    <AlertTriangle aria-hidden size={14} className="mt-0.5 shrink-0" />
                    {t('review.phoneWarning')}
                  </dd>
                )}
                {flags.includes('possible_personal_name') && (
                  <dd className="type-body-s flex gap-1.5 text-status-warning">
                    <AlertTriangle aria-hidden size={14} className="mt-0.5 shrink-0" />
                    {t('review.nameWarning')}
                  </dd>
                )}
              </div>
              {r.response_instructions && (
                <div className="flex flex-col gap-2 py-2.5">
                  <dt className="type-body-s text-secondary">{t('manage:detail.instructions')}</dt>
                  <dd className="type-body-m rounded-md border border-default bg-canvas px-3 py-2 break-words text-primary">
                    {withMaskedPhones(r.response_instructions)}
                  </dd>
                </div>
              )}
            </dl>
          </section>
  )
  const previewSection = (
          <section aria-labelledby="review-preview" className="flex flex-col gap-3">
            <h2 id="review-preview" className="type-overline text-tertiary">
              {t('review.preview')}
            </h2>
            <PreviewCard data={preview} id={r.id} footer={r.published_at ? t('request:card.reviewed') : t('review.notPublic')} />
            <AreaMap data={preview} className="h-44" />
            <p className="type-body-s flex items-center gap-1.5 text-secondary">
              <ShieldCheck aria-hidden size={14} className="shrink-0" />
              {t('review.centroidNote')}
            </p>
          </section>
  )

  return (
    <div className="flex min-h-full flex-col">
      <MobilePageHeader title={pending ? t('review.title', { id: r.id }) : r.id} backTo="/coord/queue" backLabel={t('review.back')} />
      <div className={cn('flex flex-1 flex-col gap-5 p-8 max-sm:p-4', pending && canDecide && 'max-lg:pb-40')}>
        <Link to="/coord/queue" className="type-label-m inline-flex w-fit items-center gap-1.5 rounded-sm text-primary hover:underline max-lg:hidden">
          <ArrowLeft aria-hidden size={16} />
          {t('review.back')}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <BloodTypeTag type={r.blood_type} />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="type-h1 text-primary max-lg:hidden">{pending ? t('review.title', { id: r.id }) : r.id}</h1>
                <StatusBadge status={r.status} />
              </div>
              <p className="type-body-s text-secondary">
                {t('review.submittedLine', {
                  date: formatShortDateTime(submittedAt, locale),
                  elapsed: durationLabel(submittedAt, t, now),
                  submitter,
                  point: r.coordination_point.name,
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {assigned ? (
              <span className="type-body-s inline-flex items-center gap-2 text-secondary">
                {t('review.assignedTo')}
                <Avatar initials={assigned.initials} />
                <span className="type-label-m text-primary">{assigned.is_me ? t('review.you') : assigned.name}</span>
              </span>
            ) : (
              pending &&
              r.can.assign && (
                <Button variant="secondary" loading={action.isPending} onClick={() => run('assign')}>
                  {t('review.assignToMe')}
                </Button>
              )
            )}
            {r.can.extend && (
              <Button variant="secondary" icon="calendar" disabled={owner.pending} onClick={() => owner.run.extend(r)}>
                {t('manage:actions.extend')}
              </Button>
            )}
            {r.can.fulfill && r.status === 'active' && (
              <Button variant="secondary" icon="check-circle" disabled={owner.pending} onClick={() => owner.run.fulfill(r)}>
                {t('manage:actions.fulfill')}
              </Button>
            )}
            {r.can.close && r.status === 'active' && (
              <Button variant="destructive" icon="trash" onClick={() => owner.run.close(r)}>
                {t('manage:actions.close')}
              </Button>
            )}
          </div>
        </div>

        {wide ? (
          <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
            {submittedSection}
            {previewSection}
            <div className="flex flex-col gap-4">
              <Checks request={r} />
              <ReviewHistory request={r} />
            </div>
          </div>
        ) : (
          // Below 1024 px: Submission · Preview · History tabs (44:1070).
          <Tabs defaultValue="submission">
            <TabsList aria-label={t('review.tabsLabel')}>
              <Tab value="submission">{t('review.tabs.submission')}</Tab>
              <Tab value="preview">{t('review.tabs.preview')}</Tab>
              <Tab value="history">{t('review.tabs.history')}</Tab>
            </TabsList>
            <TabsContent value="submission" className="flex flex-col gap-4 pt-4">
              <Checks request={r} />
              {submittedSection}
            </TabsContent>
            <TabsContent value="preview" className="pt-4">
              {previewSection}
            </TabsContent>
            <TabsContent value="history" className="flex flex-col gap-4 pt-4">
              <ReviewHistory request={r} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {pending && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-default bg-surface px-8 py-3 max-lg:hidden">
          <p className="type-body-s flex items-center gap-2 text-secondary">
            <ShieldCheck aria-hidden size={16} className="shrink-0" />
            {elsewhere ? t('review.assignedElsewhere', { name: assigned?.name ?? '' }) : t('review.confirmNote')}
          </p>
          {canDecide && (
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" icon="ban" disabled={action.isPending} onClick={() => setDialog('reject')}>
                {t('review.reject')}
              </Button>
              <Button variant="secondary" icon="pencil" disabled={action.isPending} onClick={() => setDialog('correction')}>
                {t('review.requestCorrection')}
              </Button>
              <Button variant="primary" icon="check" loading={action.isPending && dialog === null} onClick={() => run('approve')}>
                {t('review.approve')}
              </Button>
            </div>
          )}
        </div>
      )}

      {pending && canDecide && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-default bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button variant="primary" icon="check" className="w-full" loading={action.isPending && dialog === null} onClick={() => run('approve')}>
            {t('review.approve')}
          </Button>
          <div className="flex gap-2">
            <div className="flex-1">
              <Button variant="secondary" icon="pencil" className="w-full" disabled={action.isPending} onClick={() => setDialog('correction')}>
                {t('review.requestCorrection')}
              </Button>
            </div>
            <Button variant="destructive" icon="ban" disabled={action.isPending} onClick={() => setDialog('reject')}>
              {t('review.reject')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'correction'}
        onOpenChange={(open) => !open && setDialog(null)}
        tone="warning"
        icon="pencil"
        title={t('review.correctionTitle', { id: r.id })}
        description={t('review.correctionBody')}
        confirmLabel={t('review.sendCorrection')}
        confirmVariant="primary"
        requireReason={{
          label: t('review.correctionLabel'),
          helperText: t('review.correctionHelp'),
          requiredMessage: t('review.correctionRequired'),
          minLength: 3,
        }}
        loading={action.isPending}
        onConfirm={(reason) => run('request-correction', reason)}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        onOpenChange={(open) => !open && setDialog(null)}
        tone="critical"
        icon="ban"
        title={t('review.rejectTitle', { id: r.id })}
        description={t('review.rejectBody')}
        confirmLabel={t('review.reject')}
        confirmVariant="destructive"
        confirmIcon="ban"
        requireReason={{
          label: t('review.rejectLabel'),
          helperText: t('review.rejectHelp'),
          requiredMessage: t('review.rejectRequired'),
          minLength: 3,
        }}
        loading={action.isPending}
        onConfirm={(reason) => run('reject', reason)}
      />
      <CloseRequestDialog {...owner.closeDialog} />
    </div>
  )
}

/** Automated checks (36:498): hints from submission, never decisions. */
function Checks({ request: r }: { request: ManagedRequest }) {
  const { t } = useTranslation('coord')
  const flags = r.checks?.flags ?? []
  const rows = [
    { ok: true, title: t('review.check.location'), note: t('review.check.locationNote') },
    flags.includes('possible_phone_number')
      ? { ok: false, title: t('review.check.phone'), note: t('review.check.phoneNote') }
      : { ok: true, title: t('review.check.phoneOk') },
    flags.includes('possible_personal_name')
      ? { ok: false, title: t('review.check.name'), note: t('review.check.nameNote') }
      : { ok: true, title: t('review.check.nameOk') },
    flags.includes('desk_hours_missing')
      ? { ok: false, title: t('review.check.hours'), note: t('review.check.hoursNote') }
      : { ok: true, title: t('review.check.hoursOk') },
    r.checks?.possible_duplicate
      ? { ok: false, title: t('review.check.duplicate'), note: t('review.check.duplicateNote') }
      : { ok: true, title: t('review.check.duplicateOk') },
  ]
  return (
    <section className="overflow-hidden rounded-xl border border-default bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-default px-4 py-3.5">
        <h2 className="type-h4 text-primary">{t('review.checks')}</h2>
        <span className="type-body-s text-tertiary">{t('review.checksRun', { count: rows.length })}</span>
      </div>
      <ul className="flex flex-col gap-3 px-4 py-3.5">
        {rows.map((row) => (
          <li key={row.title} className="flex gap-2">
            {row.ok ? (
              <CheckCircle aria-hidden size={16} className="mt-0.5 shrink-0 text-status-success" />
            ) : (
              <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0 text-status-warning" />
            )}
            <div className="flex flex-col">
              <span className="type-label-m text-primary">{row.title}</span>
              {row.note && <span className="type-body-s text-secondary">{row.note}</span>}
            </div>
          </li>
        ))}
        <li className="type-body-s flex gap-2 text-secondary">
          <icons.info aria-hidden size={14} className="mt-0.5 shrink-0" />
          {t('review.checksNote')}
        </li>
      </ul>
    </section>
  )
}

function ReviewHistory({ request: r }: { request: ManagedRequest }) {
  const { t, i18n } = useTranslation(['coord', 'manage', 'states'])
  const history = useReviewHistory(r.id)
  const locale = i18n.language
  const notes = (history.data?.data ?? []).filter((e) => e.reason && ['request.correction_requested', 'request.rejected'].includes(e.action))
  const track = history.data?.meta.submitter

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-default bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-default px-4 py-3.5">
          <h2 className="type-h4 text-primary">{t('review.history')}</h2>
          <span className="type-body-s text-tertiary">{t('review.readOnly')}</span>
        </div>
        <div className="px-4 py-3.5">
          {history.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : history.isError ? (
            <div role="alert" className="flex items-center justify-between gap-2">
              <p className="type-body-s text-status-critical">{t('manage:detail.historyFailed')}</p>
              <Button variant="secondary" icon="refresh" onClick={() => void history.refetch()}>
                {t('states:networkError.action')}
              </Button>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.data.data.map((event) => (
                <li key={event.id} className="flex flex-col">
                  <span className="type-label-m text-primary">
                    {event.actor?.is_me && event.action === 'request.assigned'
                      ? t('manage:history.request.assigned')
                      : t(`manage:history.${event.action}` as 'manage:history.other', { defaultValue: t('manage:history.other') })}
                  </span>
                  <span className="type-mono-s text-tertiary">
                    {formatShortDateTime(event.created_at, locale)} · {event.actor ? (event.actor.is_me ? t('review.you') : event.actor.name) : t('manage:history.system')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-default bg-surface">
        <h2 className="type-h4 border-b border-default px-4 py-3.5 text-primary">{t('review.notes')}</h2>
        <div className="flex flex-col gap-3 px-4 py-3.5">
          {notes.length > 0 ? (
            notes.map((note) => (
              <figure key={note.id} className="flex flex-col gap-1">
                <blockquote className="type-body-s rounded-md bg-canvas px-2.5 py-2 text-secondary italic">“{note.reason}”</blockquote>
                <figcaption className="type-mono-s text-tertiary">
                  {formatShortDateTime(note.created_at, locale)} · {note.actor?.is_me ? t('review.you') : (note.actor?.name ?? t('manage:history.system'))}
                </figcaption>
              </figure>
            ))
          ) : (
            <p className={cn('type-body-s text-secondary')}>
              {t('review.noNotes')}{' '}
              {track && r.submitter?.reference
                ? t('review.track', { reference: r.submitter.reference, approved: track.approved, corrections: track.corrections })
                : null}
            </p>
          )}
        </div>
      </section>
    </>
  )
}

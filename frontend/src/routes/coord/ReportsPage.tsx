import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { FormDialog } from '../../components/ui/FormDialog'
import { Pagination } from '../../components/ui/Pagination'
import { RadioGroup } from '../../components/ui/RadioGroup'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tab, Tabs, TabsList } from '../../components/ui/Tabs'
import { TextAreaField } from '../../components/ui/TextAreaField'
import { toast } from '../../components/ui/toast'
import { useReports, useResolveReport, type ReportTab, type RequestReport } from '../../lib/api/coordinator'
import type { BloodType } from '../../lib/request'
import { cn } from '../../lib/cn'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { agoLabel, reviewHref } from './coordText'

const TABS: ReportTab[] = ['open', 'closed']

/** Who reported: a submitter reference ("S-0142") or a role, never a name. */
function reporterLabel(reporter: string | null, t: ReturnType<typeof useTranslation<'coord'>>['t']): string {
  if (reporter === null) return t('reports.reporter.deleted')
  return t(`reports.reporter.${reporter}` as 'reports.reporter.donor', { defaultValue: reporter })
}

/** "Handle report": resolved (acted on) or dismissed, with an optional note. */
function HandleDialog({ report, onClose }: { report: RequestReport | null; onClose: () => void }) {
  const { t } = useTranslation(['coord', 'common'])
  const resolve = useResolveReport()
  const [outcome, setOutcome] = useState<'resolved' | 'dismissed'>('resolved')
  const [note, setNote] = useState('')

  const close = () => {
    setOutcome('resolved')
    setNote('')
    onClose()
  }

  const save = () => {
    if (!report) return
    resolve.mutate(
      { id: report.id, resolution: outcome, note: note.trim() },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: t('reports.dialog.done'), message: `${report.request.id} · ${t(`reports.outcome.${outcome}`)}` })
          close()
        },
        onError: () => toast({ tone: 'error', title: t('reports.dialog.failed'), message: t('review.failedBody') }),
      },
    )
  }

  return (
    <FormDialog
      open={report !== null}
      onOpenChange={(open) => !open && close()}
      icon="flag"
      title={t('reports.dialog.title', { id: report?.request.id ?? '' })}
      description={t('reports.dialog.body')}
    >
      {report && (
        <div className="flex flex-col gap-4">
          <dl className="overflow-hidden rounded-lg border border-default">
            <div className="flex gap-3 border-b border-default px-3 py-2.5 last:border-b-0">
              <dt className="type-body-s w-28 shrink-0 text-secondary">{t('reports.dialog.reason')}</dt>
              <dd className="type-body-m text-primary">{t(`reports.reasons.${report.reason}`)}</dd>
            </div>
            {report.details && (
              <div className="flex gap-3 px-3 py-2.5">
                <dt className="type-body-s w-28 shrink-0 text-secondary">{t('reports.dialog.details')}</dt>
                <dd className="type-body-m min-w-0 break-words whitespace-pre-line text-primary">{report.details}</dd>
              </div>
            )}
          </dl>
          <Button asChild variant="secondary" className="w-fit">
            <Link to={reviewHref(report.request.id)}>{t('reports.review')}</Link>
          </Button>
          <fieldset className="flex flex-col gap-2">
            <legend className="type-label-m mb-2 text-primary">{t('reports.dialog.outcome')}</legend>
            <RadioGroup
              label={t('reports.dialog.outcome')}
              value={outcome}
              onValueChange={(v) => setOutcome(v as 'resolved' | 'dismissed')}
              options={[
                { value: 'resolved', label: t('reports.dialog.resolved') },
                { value: 'dismissed', label: t('reports.dialog.dismissed') },
              ]}
            />
          </fieldset>
          <TextAreaField
            label={t('reports.dialog.note')}
            helperText={t('reports.dialog.noteHelp')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxChars={500}
            charCount={note.length}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              {t('common:actions.cancel')}
            </Button>
            <Button icon="check" onClick={save} loading={resolve.isPending} disabled={note.length > 500}>
              {t('reports.dialog.save')}
            </Button>
          </div>
        </div>
      )}
    </FormDialog>
  )
}

/** Coordinator / Reports (35:12 nav item, decision #94): open flags first, handled ones kept with their note. */
export function ReportsPage() {
  const { t } = useTranslation(['coord', 'states'])
  useDocumentTitle(t('reports.title'))
  const [params, setParams] = useSearchParams()
  const tab: ReportTab = params.get('tab') === 'closed' ? 'closed' : 'open'
  const page = Number(params.get('page') ?? '1') || 1
  const reports = useReports(tab, page)
  const [handling, setHandling] = useState<RequestReport | null>(null)
  const [now] = useState(() => new Date())
  const head = 'type-overline h-10 px-3 text-left font-semibold whitespace-nowrap text-secondary'
  const cell = 'px-3 py-2.5 align-middle'

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <Tabs value={tab} onValueChange={(value) => setParams(value === 'open' ? {} : { tab: value }, { replace: true })}>
        <TabsList aria-label={t('reports.caption')}>
          {TABS.map((key) => (
            <Tab key={key} value={key} aria-controls="reports-results" count={reports.data?.meta.counts[key]}>
              {t(`reports.tabs.${key}`)}
            </Tab>
          ))}
        </TabsList>
      </Tabs>

      <div id="reports-results">
        {reports.isPending ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : reports.isError ? (
          <EmptyState
            role="alert"
            tone="critical"
            icon="wifi-off"
            title={t('states:networkError.title')}
            description={t('states:networkError.body')}
            actions={
              <Button variant="secondary" icon="refresh" onClick={() => void reports.refetch()}>
                {t('states:networkError.action')}
              </Button>
            }
          />
        ) : reports.data.data.length === 0 ? (
          <EmptyState
            icon="flag"
            title={t(tab === 'open' ? 'reports.emptyOpen' : 'reports.emptyClosed')}
            description={t(tab === 'open' ? 'reports.emptyOpenBody' : 'reports.emptyClosedBody')}
            actions={null}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-lg border border-default">
              <table className="w-full min-w-200 border-collapse">
                <caption className="sr-only">{t('reports.caption')}</caption>
                <thead className="bg-subtle">
                  <tr>
                    <th scope="col" className={head}>{t('reports.columns.request')}</th>
                    <th scope="col" className={head}>{t('reports.columns.reason')}</th>
                    <th scope="col" className={head}>{t('reports.columns.reporter')}</th>
                    <th scope="col" className={head}>{t('reports.columns.reported')}</th>
                    <th scope="col" className={head}>{tab === 'open' ? <span className="sr-only">{t('reports.columns.actions')}</span> : t('reports.columns.outcome')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.data.data.map((r) => (
                    <tr key={r.id} className="border-t border-default bg-surface">
                      <th scope="row" className={cn(cell, 'text-left font-normal')}>
                        <span className="flex items-center gap-3">
                          <BloodTypeTag type={r.request.blood_type as BloodType} size="sm" />
                          <span className="flex min-w-0 flex-col">
                            <Link to={reviewHref(r.request.id)} className="type-mono-m text-primary hover:underline">
                              {r.request.id}
                            </Link>
                            <span className="type-body-s truncate text-secondary">{r.request.municipality}</span>
                          </span>
                        </span>
                      </th>
                      <td className={cn(cell, 'max-w-80')}>
                        <span className="type-body-m text-primary">{t(`reports.reasons.${r.reason}`)}</span>
                        {r.details && <span className="type-body-s line-clamp-2 block text-secondary">{r.details}</span>}
                      </td>
                      <td className={cn(cell, 'type-body-s whitespace-nowrap text-secondary')}>{reporterLabel(r.reporter, t)}</td>
                      <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                        <time dateTime={r.reported_at}>{agoLabel(r.reported_at, t, now)}</time>
                      </td>
                      <td className={cell}>
                        {r.status === 'open' ? (
                          <Button variant="secondary" onClick={() => setHandling(r)}>
                            {t('reports.handle')}
                          </Button>
                        ) : (
                          <span className="flex flex-col gap-0.5">
                            <span
                              className={cn(
                                'type-label-s inline-flex w-fit rounded-sm px-1.5 py-0.5',
                                r.status === 'resolved' ? 'bg-status-success text-status-success' : 'bg-subtle text-secondary',
                              )}
                            >
                              {t(`reports.outcome.${r.status}`)}
                            </span>
                            {r.resolved_by && (
                              <span className="type-body-s text-secondary">
                                {t('reports.by', { name: r.resolved_by === 'you' ? t('reports.you') : r.resolved_by })}
                              </span>
                            )}
                            {r.resolution_note && <span className="type-body-s line-clamp-2 text-secondary">{r.resolution_note}</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reports.data.meta.last_page > 1 && (
              <Pagination
                meta={{ ...reports.data.meta, per_page: 20 }}
                onPageChange={(p) => setParams({ ...(tab === 'closed' ? { tab } : {}), page: String(p) })}
              />
            )}
          </div>
        )}
      </div>
      <HandleDialog report={handling} onClose={() => setHandling(null)} />
    </div>
  )
}

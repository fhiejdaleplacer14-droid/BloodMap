import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons, type IconName } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { useMe } from '../../lib/api/auth'
import { errorStatus } from '../../lib/api/client'
import { useManagedRequest } from '../../lib/api/myRequests'
import { cn } from '../../lib/cn'
import { formatShortDateTime } from '../../lib/datetime'
import { displayBloodType } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { windowClosesAt } from './requestForm'

/**
 * Requests / Create — Submitted · Pending review (31:1104). The frame's
 * fixed card height is a design bug; the card sizes to its content.
 */
export function SubmittedPage() {
  const { t, i18n } = useTranslation(['manage', 'states'])
  const { id = '' } = useParams()
  const me = useMe().data
  const request = useManagedRequest(id)
  useDocumentTitle(t('submitted.title'))
  const locale = i18n.language

  if (request.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-6 p-8 max-sm:p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full max-w-180 rounded-xl" />
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
            <Button asChild variant="secondary">
              <Link to="/requests/mine">{t('submitted.back')}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const r = request.data
  const closes = r.expires_at ?? (r.needed_by ? windowClosesAt(r.needed_by, r.desk_window?.[1] ?? '') : null)
  const steps: { icon: IconName; title: string; meta: string; done?: boolean }[] = [
    {
      icon: 'send',
      title: t('submitted.steps.submitted'),
      meta: t('submitted.steps.submittedMeta', {
        date: formatShortDateTime(r.submitted_at ?? r.updated_at, locale),
        name: me?.name ?? '',
      }),
      done: true,
    },
    { icon: 'clock', title: t('submitted.steps.review'), meta: t('submitted.steps.reviewMeta') },
    { icon: 'map', title: t('submitted.steps.published'), meta: t('submitted.steps.publishedMeta') },
    {
      icon: 'hourglass',
      title: t('submitted.steps.expires'),
      meta: closes ? t('submitted.steps.expiresMeta', { when: formatShortDateTime(closes, locale) }) : t('submitted.steps.expiresUnknown'),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader title={t('submitted.title')} />
      <section className="flex max-w-180 flex-col gap-5 rounded-xl border border-default bg-surface p-6 max-sm:p-4">
        <div className="flex items-center gap-3">
          <BloodTypeTag type={r.blood_type} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="type-mono-m text-secondary">{r.id}</span>
            <span className="type-label-m text-primary">
              {displayBloodType(r.blood_type)} · {r.location.municipality}
            </span>
          </div>
          <StatusBadge status={r.status} />
        </div>
        <p className="type-body-m text-secondary">{t('submitted.body')}</p>

        <div className="flex flex-col gap-3">
          <h2 className="type-h4 text-primary">{t('submitted.next')}</h2>
          <ol className="flex flex-col">
            {steps.map((step, index) => {
              const Icon = icons[step.icon]
              const last = index === steps.length - 1
              return (
                <li key={step.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full',
                        step.done ? 'bg-inverse text-on-inverse' : 'bg-subtle text-secondary',
                      )}
                    >
                      <Icon aria-hidden size={14} />
                    </span>
                    {!last && <span aria-hidden className="w-0.5 flex-1 bg-line" />}
                  </div>
                  <div className={cn('flex flex-col gap-0.5', !last && 'pb-4')}>
                    <p className="type-label-m text-primary">{step.title}</p>
                    <p className="type-body-s text-secondary">{step.meta}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary">
            <Link to={`/requests/mine/${encodeURIComponent(r.id)}`}>{t('submitted.view')}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/requests/mine">{t('submitted.back')}</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { DateField } from '../../components/ui/DateTimeField'
import { EmptyState } from '../../components/ui/EmptyState'
import { Pagination } from '../../components/ui/Pagination'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/toast'
import { useMe } from '../../lib/api/auth'
import { ACTIVITY_GROUPS, downloadMyData, useActivity, type ActivityGroup } from '../../lib/api/me'
import { manilaToday } from '../../lib/dates'
import { formatShortDateTime } from '../../lib/datetime'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { activityDetail, activityLabel } from './activityText'

const COLUMNS = ['date', 'action', 'request', 'status', 'detail'] as const

/** Donor / My Activity (29:625). */
export function ActivityPage() {
  const { t, i18n } = useTranslation(['workspace', 'states', 'explorer'])
  useDocumentTitle(t('crumbs.activity'))
  const { data: me } = useMe()
  const [group, setGroup] = useState<ActivityGroup | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [downloading, setDownloading] = useState(false)
  const rangeValid = !from || !to || to >= from

  const activity = useActivity({
    group: group || undefined,
    from: from || undefined,
    to: rangeValid ? to || undefined : undefined,
    page,
  })
  const following = me?.preferences.email_saved_status_changes ?? false

  const download = async () => {
    setDownloading(true)
    try {
      await downloadMyData()
    } catch {
      toast({ tone: 'error', title: t('states:networkError.title'), message: t('states:networkError.body') })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
        actions={
          <Button variant="secondary" loading={downloading} onClick={() => void download()}>
            {t('activity.download')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-60 max-sm:w-full">
          <SelectField
            label={t('activity.action')}
            value={group}
            onChange={(event) => {
              setGroup(event.target.value as ActivityGroup | '')
              setPage(1)
            }}
          >
            <option value="">{t('activity.allActions')}</option>
            {ACTIVITY_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`activity.groups.${g}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-50 max-sm:w-full">
          <DateField
            label={t('activity.from')}
            value={from}
            max={manilaToday()}
            onChange={(event) => {
              setFrom(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="w-50 max-sm:w-full">
          <DateField
            label={t('activity.to')}
            value={to}
            max={manilaToday()}
            error={rangeValid ? undefined : t('explorer:filters.rangeError')}
            onChange={(event) => {
              setTo(event.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {activity.isPending ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : activity.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void activity.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-default bg-surface">
            <table className="w-full min-w-200 border-collapse text-left" aria-busy={activity.isFetching || undefined}>
              <caption className="sr-only">{t('activity.title')}</caption>
              <thead className="bg-subtle">
                <tr className="border-b border-default">
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col" className="type-overline h-10 px-4 text-secondary">
                      {t(`activity.columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.data.data.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="type-body-s px-4 py-8 text-center text-secondary">
                      {t('activity.empty')}
                    </td>
                  </tr>
                ) : (
                  activity.data.data.map((item) => (
                    <tr key={item.id} className="border-b border-default last:border-b-0">
                      <td className="type-mono-s h-13 w-42 px-4 whitespace-nowrap text-secondary">
                        <time dateTime={item.created_at}>{formatShortDateTime(item.created_at, i18n.language)}</time>
                      </td>
                      <td className="type-body-m w-65 px-4 text-primary">{activityLabel(item, t)}</td>
                      <td className="w-40 px-4">
                        {item.request ? <span className="type-mono-s text-primary">{item.request}</span> : <span className="type-body-m text-primary">—</span>}
                      </td>
                      <td className="w-42 px-4">
                        {item.request_status ? <StatusBadge status={item.request_status} /> : <span className="type-body-m text-primary">—</span>}
                      </td>
                      <td className="type-body-m px-4 text-secondary">{activityDetail(item, t, following) ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {activity.data.meta.total > 0 &&
            (activity.data.meta.last_page > 1 ? (
              <Pagination meta={activity.data.meta} onPageChange={setPage} />
            ) : (
              <p className="type-body-s text-secondary">
                {t('activity.summary', { from: 1, to: activity.data.data.length, total: activity.data.meta.total })}
              </p>
            ))}
        </>
      )}
    </div>
  )
}

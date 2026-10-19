import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAdminCoordinators } from '../../lib/api/admin'
import { cn } from '../../lib/cn'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { agoLabel } from '../coord/coordText'
import { StatusTag } from './UserDialogs'

const MapPin = icons['map-pin']
const AlertTriangle = icons['alert-triangle']

/** Admin / Coordinator Management (41:1289): who reviews where, and the gaps. */
export function CoordinatorsPage() {
  const { t, i18n } = useTranslation(['admin', 'states'])
  const { t: tCoord } = useTranslation('coord')
  useDocumentTitle(t('coordinators.title'))
  const list = useAdminCoordinators()
  const [now] = useState(() => new Date())
  const uncovered = list.data?.meta.uncovered_areas ?? []
  const areaNames = new Intl.ListFormat(i18n.language, { type: 'disjunction' }).format(uncovered.map((a) => a.name))
  const head = 'type-overline h-10 px-3 text-left font-semibold whitespace-nowrap text-secondary'
  const cell = 'px-3 py-2.5 align-middle'

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('coordinators.title')}
        subtitle={t('coordinators.subtitle')}
        actions={
          <Button asChild variant="primary">
            <Link to="/admin/users?role=donor">
              <icons.plus aria-hidden size={16} />
              {t('coordinators.assign')}
            </Link>
          </Button>
        }
      />

      {uncovered.length > 0 && (
        <p role="note" className="type-body-m flex gap-2 rounded-lg bg-status-warning px-4 py-3 text-status-warning">
          <AlertTriangle aria-hidden size={18} className="mt-0.5 shrink-0" />
          {t('coordinators.uncovered', { count: uncovered.length, areas: areaNames })}
        </p>
      )}

      {list.isPending ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : list.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void list.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : list.data.data.length === 0 ? (
        <EmptyState icon="shield-check" title={tCoord('queue.emptyTitle')} description={t('coordinators.empty')} actions={null} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-default">
          <table className="w-full min-w-220 border-collapse">
            <caption className="sr-only">{t('coordinators.caption')}</caption>
            <thead className="bg-subtle">
              <tr>
                {(['coordinator', 'area', 'authorization', 'account', 'reviews', 'lastActive'] as const).map((key) => (
                  <th key={key} scope="col" className={head}>
                    {t(`coordinators.columns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((c) => (
                <tr key={c.id} className="border-t border-default bg-surface">
                  <th scope="row" className={cn(cell, 'text-left font-normal')}>
                    <span className="flex items-center gap-3">
                      <Avatar initials={c.initials} size="md" />
                      <span className="flex min-w-0 flex-col">
                        <span className="type-label-m truncate text-primary">{c.name}</span>
                        <span className="type-body-s truncate text-secondary">{c.email}</span>
                      </span>
                    </span>
                  </th>
                  <td className={cn(cell, 'type-body-m whitespace-nowrap text-primary')}>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden size={14} className="text-secondary" />
                      {c.area?.short_name ?? t('coordinators.noArea')}
                    </span>
                  </td>
                  <td className={cell}>
                    {c.area && !c.restricted && (
                      <span className="type-label-s inline-flex rounded-sm bg-status-success px-1.5 py-0.5 text-status-success">{t('coordinators.authorized')}</span>
                    )}
                  </td>
                  <td className={cell}>
                    <StatusTag status={c.restricted ? 'restricted' : c.email_verified ? 'active' : 'unverified'} />
                  </td>
                  <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                    {c.reviews_30d.approved} / {c.reviews_30d.corrections} / {c.reviews_30d.rejected}
                  </td>
                  <td className={cn(cell, 'type-mono-s whitespace-nowrap text-secondary')}>
                    {c.last_active_at ? agoLabel(c.last_active_at, tCoord, now) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

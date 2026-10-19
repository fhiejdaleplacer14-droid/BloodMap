import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Pagination } from '../../components/ui/Pagination'
import { Skeleton } from '../../components/ui/Skeleton'
import { useMarkNotificationsRead, useNotifications } from '../../lib/api/me'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { UpdateRow } from './UpdateRow'

/**
 * Notifications (sidebar 28:20, "All notifications" 28:180). No frame of its
 * own: it lists the same update rows as the dashboard panel.
 */
export function NotificationsPage() {
  const { t } = useTranslation(['workspace', 'states'])
  useDocumentTitle(t('crumbs.notifications'))
  const [page, setPage] = useState(1)
  const notifications = useNotifications(page)
  const markRead = useMarkNotificationsRead()
  const unread = notifications.data?.meta.unread ?? 0

  return (
    <div className="flex flex-col gap-6 p-8 max-sm:p-4">
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={
          unread > 0 && (
            <Button variant="secondary" icon="check" loading={markRead.isPending} onClick={() => markRead.mutate()}>
              {t('notifications.markRead')}
            </Button>
          )
        }
      />
      {notifications.isPending ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : notifications.isError ? (
        <EmptyState
          role="alert"
          tone="critical"
          icon="wifi-off"
          title={t('states:networkError.title')}
          description={t('states:networkError.body')}
          actions={
            <Button variant="secondary" icon="refresh" onClick={() => void notifications.refetch()}>
              {t('states:networkError.action')}
            </Button>
          }
        />
      ) : notifications.data.data.length === 0 ? (
        <EmptyState
          icon="bell"
          title={t('notifications.empty')}
          description={t('notifications.emptyBody')}
          actions={
            <Button asChild variant="secondary">
              <Link to="/requests">{t('states:noSaved.action')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section className="overflow-hidden rounded-lg border border-default bg-surface">
            <ul>
              {notifications.data.data.map((n) => (
                <UpdateRow key={n.id} notification={n} />
              ))}
            </ul>
          </section>
          {notifications.data.meta.last_page > 1 && (
            <Pagination
              meta={notifications.data.meta}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  )
}

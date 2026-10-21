import { Link, Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMe, type Me } from '../../lib/api/auth'
import { useNotifications } from '../../lib/api/me'
import { useCoordinatorSummary } from '../../lib/api/coordinator'
import { useMyRequestCounts } from '../../lib/api/myRequests'
import { isAdmin, isReviewer, isSubmitter, workspaceBottomNav, workspaceNav } from '../../lib/workspaceNav'
import { DemoBadge } from '../map/MapOverlays'
import { IconButton } from '../ui/IconButton'
import { icons } from '../ui/icons'
import { Skeleton } from '../ui/Skeleton'
import { Assistant } from '../assistant/Assistant'
import { AppSidebar } from './AppSidebar'
import { BottomNav } from './BottomNav'
import { MobileTopBar } from './MobileTopBar'
import { AccountMenu, SkipLink } from './SiteHeader'

const ChevronRight = icons['chevron-right']

/**
 * Route handle: the breadcrumb under "My workspace" (28:151) or, for request
 * pages, under "Requests" (31:164). `crumb: 'param'` shows the :id.
 */
export type WorkspaceHandle = {
  crumb:
    | 'overview' | 'saved' | 'activity' | 'notifications' | 'profile' | 'myRequests' | 'drafts' | 'create' | 'param'
    | 'queue' | 'active' | 'closed' | 'users' | 'coordinators' | 'audit' | 'settings'
  section?: 'requests' | 'coord' | 'admin'
  /** Focused task (create, review): below 1024 px the page's own header and sticky actions replace the top bar and bottom nav. */
  focus?: boolean
}

function roleLabel(me: Me, t: ReturnType<typeof useTranslation<'nav'>>['t']): string {
  switch (me.role) {
    case 'coordinator':
      return t('role.coordinator', { area: me.area?.short_name ?? '' })
    case 'admin':
      return t('role.admin')
    case 'facility_submitter':
      return t('role.facility_submitter', { desk: me.reference ?? '' })
    default:
      return t('role.donor')
  }
}

/** Signed-in routes only; guests go to sign-in and come back (decision #34). */
export function RequireAuth({ children }: { children: (me: Me) => React.ReactNode }) {
  const { data: me, isPending } = useMe()
  const { pathname, search } = useLocation()

  if (isPending) {
    return (
      <div aria-busy="true" className="flex h-dvh items-center justify-center bg-canvas">
        <Skeleton className="h-8 w-40" />
      </div>
    )
  }
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(`${pathname}${search}`)}`} replace />
  return <>{children(me)}</>
}

function Shell({ me }: { me: Me }) {
  const { t } = useTranslation(['workspace', 'coord', 'admin'])
  const { t: tNav } = useTranslation('nav')
  const navigate = useNavigate()
  const unread = useNotifications().data?.meta.unread ?? 0
  const counts = useMyRequestCounts(isSubmitter(me)).data
  const summary = useCoordinatorSummary(isReviewer(me)).data
  const matches = useMatches()
  const leaf = matches.at(-1)
  const handle = (leaf?.handle as WorkspaceHandle | undefined) ?? { crumb: 'overview' }
  const crumbLabel =
    handle.crumb === 'param'
      ? (leaf?.params.id ?? '')
      : handle.section === 'coord'
        ? t(`coord:crumbs.${handle.crumb}` as 'coord:crumbs.overview')
        : handle.section === 'admin'
          ? t(`admin:crumbs.${handle.crumb}` as 'admin:crumbs.overview')
          : t(`crumbs.${handle.crumb}` as 'crumbs.overview')
  const root =
    handle.section === 'requests'
      ? { to: '/requests/mine', label: t('requestsRoot') }
      : handle.section === 'admin' || (handle.section === 'coord' && isAdmin(me))
        ? { to: '/admin', label: t('admin:root') }
        : handle.section === 'coord'
          ? { to: '/coord', label: t('coord:root') }
          : { to: '/app', label: t('breadcrumbRoot') }

  const bell = (
    <IconButton
      icon="bell"
      label={unread ? `${t('nav.notifications')} (${unread})` : t('nav.notifications')}
      onClick={() => navigate('/app/notifications')}
      className="relative"
    />
  )

  return (
    <div className="flex h-dvh bg-canvas">
      <SkipLink />
      <AppSidebar
        className="max-lg:hidden"
        roleLabel={roleLabel(me, tNav)}
        roleIcon={isReviewer(me) ? 'shield-check' : 'user'}
        items={workspaceNav(me, t, { unread, active: counts?.active, drafts: counts?.draft, queue: summary?.all_open, reports: summary?.open_reports })}
        helpItem={{ to: '/#safety', label: t('nav.help'), icon: 'help-chat' }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {!handle.focus && (
          <MobileTopBar
            className="lg:hidden"
            actions={
              <>
                {bell}
                <AccountMenu me={me} inWorkspace />
              </>
            }
          />
        )}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-default bg-surface px-8 max-lg:hidden">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Link to={root.to} className="type-body-m rounded-sm text-tertiary hover:text-primary">
                  {root.label}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight size={14} className="text-tertiary" />
              </li>
              <li aria-current="page" className="type-label-m text-primary">
                {crumbLabel}
              </li>
            </ol>
          </nav>
          <div className="flex items-center gap-2">
            {me.is_demo && <DemoBadge>{t('demo')}</DemoBadge>}
            {bell}
            <AccountMenu me={me} inWorkspace />
          </div>
        </header>
        {/* Focusable so keyboard users can scroll pages that have nothing else to focus (WCAG 2.1.1). */}
        <main id="main" tabIndex={0} className="relative min-h-0 flex-1 scroll-pb-24 overflow-y-auto max-lg:scroll-pb-44">
          <Outlet />
        </main>
        {!handle.focus && <BottomNav className="lg:hidden" items={workspaceBottomNav(me, t)} />}
        {/* Donors get the guide (44:954); staff workspaces don't show it. */}
        {me.role === 'donor' && <Assistant raised />}
      </div>
    </div>
  )
}

/** Donor workspace layout (06 · Donor Workspace): App Sidebar 264 + main. */
export function WorkspaceLayout() {
  return <RequireAuth>{(me) => <Shell me={me} />}</RequireAuth>
}

/** Page header shared by workspace pages (28:171). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 max-md:flex-col max-md:items-start">
      <div className="flex max-w-160 flex-col gap-1.5">
        <h1 className="type-h1 text-primary">{title}</h1>
        {subtitle && <p className="type-body-m text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** White panel with a header row (28:177). */
export function Panel({
  title,
  titleNote,
  subtitle,
  action,
  children,
  className,
}: {
  title: string
  /** Muted qualifier beside the title, e.g. "oldest first" (35:12). */
  titleNote?: string
  /** Second line under the title, e.g. "Created vs. expired without update · daily" (38:2). */
  subtitle?: string
  action?: { label: string; to: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border border-default bg-surface ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-3 border-b border-default px-5 py-4">
        <div className="flex min-w-0 flex-col">
          <h2 className="type-h4 text-primary">
            {title}
            {titleNote && <span className="type-body-s ml-2 font-normal text-tertiary">{titleNote}</span>}
          </h2>
          {subtitle && <p className="type-body-s text-tertiary">{subtitle}</p>}
        </div>
        {action && (
          <Link to={action.to} className="type-label-m inline-flex shrink-0 items-center gap-0.5 rounded-sm text-link hover:underline">
            {action.label}
            <ChevronRight aria-hidden size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

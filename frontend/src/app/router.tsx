import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RequestRedirect } from '../routes/RequestRedirect'
import { RouteError } from './RouteError'

/** Internal reference pages (tokens, components). Never shipped to production. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/tokens',
        lazy: async () => ({ Component: (await import('../routes/dev/TokensPage')).TokensPage }),
      },
      {
        path: 'dev/components',
        lazy: async () => ({ Component: (await import('../routes/dev/ComponentsPage')).ComponentsPage }),
      },
    ]
  : []

export const router = createBrowserRouter([
  {
    path: '/',
    // Lazy routes resolve before first render; nothing to show meanwhile.
    HydrateFallback: () => null,
    ErrorBoundary: RouteError,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('../routes/landing/LandingPage')).LandingPage }),
      },
      {
        path: 'requests',
        lazy: async () => ({ Component: (await import('../routes/explorer/ExplorerPage')).ExplorerPage }),
      },
      { path: 'requests/:id', Component: RequestRedirect },
      {
        path: 'login',
        lazy: async () => ({ Component: (await import('../routes/auth/LoginPage')).LoginPage }),
      },
      {
        path: 'register',
        lazy: async () => ({ Component: (await import('../routes/auth/RegisterPage')).RegisterPage }),
      },
      {
        path: 'forgot-password',
        lazy: async () => ({ Component: (await import('../routes/auth/ForgotPasswordPage')).ForgotPasswordPage }),
      },
      {
        path: 'reset-password',
        lazy: async () => ({ Component: (await import('../routes/auth/ResetPasswordPage')).ResetPasswordPage }),
      },
      {
        path: 'app',
        lazy: async () => ({ Component: (await import('../components/layout/WorkspaceLayout')).WorkspaceLayout }),
        children: [
          {
            index: true,
            handle: { crumb: 'overview' },
            lazy: async () => ({ Component: (await import('../routes/donor/DashboardPage')).DashboardPage }),
          },
          {
            path: 'saved',
            handle: { crumb: 'saved' },
            lazy: async () => ({ Component: (await import('../routes/donor/SavedPage')).SavedPage }),
          },
          {
            path: 'activity',
            handle: { crumb: 'activity' },
            lazy: async () => ({ Component: (await import('../routes/donor/ActivityPage')).ActivityPage }),
          },
          {
            path: 'notifications',
            handle: { crumb: 'notifications' },
            lazy: async () => ({ Component: (await import('../routes/donor/NotificationsPage')).NotificationsPage }),
          },
          {
            path: 'profile',
            handle: { crumb: 'profile' },
            lazy: async () => ({ Component: (await import('../routes/donor/ProfilePage')).ProfilePage }),
          },
        ],
      },
      {
        // Owner request pages share the workspace shell (07 · Request Management).
        lazy: async () => ({ Component: (await import('../components/layout/WorkspaceLayout')).WorkspaceLayout }),
        children: [
          {
            path: 'admin',
            lazy: async () => ({ Component: (await import('../routes/admin/AdminGate')).AdminGate }),
            children: [
              {
                index: true,
                handle: { crumb: 'overview', section: 'admin' },
                lazy: async () => ({ Component: (await import('../routes/admin/AdminOverviewPage')).AdminOverviewPage }),
              },
              {
                path: 'users',
                handle: { crumb: 'users', section: 'admin' },
                lazy: async () => ({ Component: (await import('../routes/admin/UsersPage')).UsersPage }),
              },
              {
                path: 'coordinators',
                handle: { crumb: 'coordinators', section: 'admin' },
                lazy: async () => ({ Component: (await import('../routes/admin/CoordinatorsPage')).CoordinatorsPage }),
              },
              {
                path: 'audit',
                handle: { crumb: 'audit', section: 'admin' },
                lazy: async () => ({ Component: (await import('../routes/admin/AuditLogsPage')).AuditLogsPage }),
              },
              {
                path: 'settings',
                handle: { crumb: 'settings', section: 'admin' },
                lazy: async () => ({ Component: (await import('../routes/admin/SettingsPage')).SettingsPage }),
              },
            ],
          },
          {
            path: 'coord',
            lazy: async () => ({ Component: (await import('../routes/coord/CoordGate')).CoordGate }),
            children: [
              {
                index: true,
                handle: { crumb: 'overview', section: 'coord' },
                lazy: async () => ({ Component: (await import('../routes/coord/CoordOverviewPage')).CoordOverviewPage }),
              },
              {
                path: 'queue',
                handle: { crumb: 'queue', section: 'coord' },
                lazy: async () => ({ Component: (await import('../routes/coord/QueuePage')).QueuePage }),
              },
              {
                path: 'active',
                handle: { crumb: 'active', section: 'coord' },
                lazy: async () => {
                  const { CoordListPage } = await import('../routes/coord/QueuePage')
                  return { Component: () => <CoordListPage tab="active" /> }
                },
              },
              {
                path: 'closed',
                handle: { crumb: 'closed', section: 'coord' },
                lazy: async () => {
                  const { CoordListPage } = await import('../routes/coord/QueuePage')
                  return { Component: () => <CoordListPage tab="closed" /> }
                },
              },
              {
                path: 'requests/:id',
                handle: { crumb: 'param', section: 'coord', focus: true },
                lazy: async () => ({ Component: (await import('../routes/coord/ReviewPage')).ReviewPage }),
              },
              {
                path: 'activity',
                handle: { crumb: 'activity', section: 'coord' },
                lazy: async () => ({ Component: (await import('../routes/coord/CoordActivityPage')).CoordActivityPage }),
              },
            ],
          },
          {
            lazy: async () => ({ Component: (await import('../routes/requests/RequestsGate')).RequestsGate }),
            children: [
              {
                path: 'requests/new',
                handle: { crumb: 'create', section: 'requests', focus: true },
                lazy: async () => ({ Component: (await import('../routes/requests/CreateRequestPage')).CreateRequestPage }),
              },
              {
                path: 'requests/mine',
                handle: { crumb: 'myRequests', section: 'requests' },
                lazy: async () => ({ Component: (await import('../routes/requests/MyRequestsPage')).MyRequestsPage }),
              },
              {
                path: 'requests/drafts',
                handle: { crumb: 'drafts', section: 'requests' },
                lazy: async () => ({ Component: (await import('../routes/requests/MyRequestsPage')).DraftsPage }),
              },
              {
                path: 'requests/mine/:id',
                handle: { crumb: 'param', section: 'requests' },
                lazy: async () => ({ Component: (await import('../routes/requests/OwnerDetailPage')).OwnerDetailPage }),
              },
              {
                path: 'requests/mine/:id/submitted',
                handle: { crumb: 'myRequests', section: 'requests' },
                lazy: async () => ({ Component: (await import('../routes/requests/SubmittedPage')).SubmittedPage }),
              },
            ],
          },
        ],
      },
      ...devRoutes,
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

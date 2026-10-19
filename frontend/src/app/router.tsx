import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RequestRedirect } from '../routes/RequestRedirect'

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
      ...devRoutes,
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

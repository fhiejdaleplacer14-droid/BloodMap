import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

/** Internal reference pages (tokens, components). Never shipped to production. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { index: true, element: <Navigate to="/dev/tokens" replace /> },
      {
        path: 'dev/tokens',
        lazy: async () => ({ Component: (await import('../routes/dev/TokensPage')).TokensPage }),
      },
    ]
  : []

export const router = createBrowserRouter([
  {
    path: '/',
    children: [...devRoutes],
  },
])

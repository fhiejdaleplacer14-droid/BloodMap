import { Navigate, Outlet } from 'react-router'
import { homeFor, useMe } from '../../lib/api/auth'

/**
 * Owner pages are for accounts that can own requests (facility submitters).
 * Anyone else lands on their own home instead of a page of 403s.
 */
export function RequestsGate() {
  const me = useMe().data
  if (me && !me.permissions.includes('requests.own')) return <Navigate to={homeFor(me)} replace />
  return <Outlet />
}

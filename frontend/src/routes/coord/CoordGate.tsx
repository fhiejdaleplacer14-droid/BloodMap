import { Navigate, Outlet } from 'react-router'
import { homeFor, useMe } from '../../lib/api/auth'

/** Coordinator pages need review permissions from /api/me; anyone else goes home. */
export function CoordGate() {
  const me = useMe().data
  if (me && !me.permissions.includes('review.queue')) return <Navigate to={homeFor(me)} replace />
  return <Outlet />
}

import { Navigate, Outlet } from 'react-router'
import { homeFor, useMe } from '../../lib/api/auth'

/** Administration needs admin permissions from /api/me; anyone else goes home. */
export function AdminGate() {
  const me = useMe().data
  if (me && !me.permissions.includes('admin.users')) return <Navigate to={homeFor(me)} replace />
  return <Outlet />
}

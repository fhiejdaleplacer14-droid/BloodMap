import { Navigate, useParams } from 'react-router'

/** /requests/:id is a shareable alias of the Explorer with that request selected (51:423). */
export function RequestRedirect() {
  const { id = '' } = useParams()
  return <Navigate to={`/requests?sel=${encodeURIComponent(id)}`} replace />
}

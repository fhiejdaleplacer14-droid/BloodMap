import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { parseExplorerParams, serializeExplorerParams, type ExplorerParams } from '../../lib/explorer/params'

type Patch = Partial<ExplorerParams> | ((current: ExplorerParams) => Partial<ExplorerParams>)

/**
 * Explorer state lives in the query string (55:189). Filters and selection
 * push history (Back/Forward restore them); the viewport replaces it (55:206).
 */
export function useExplorerParams() {
  const [search, setSearch] = useSearchParams()
  const params = useMemo(() => parseExplorerParams(search), [search])

  const update = useCallback(
    (patch: Patch, options: { replace?: boolean } = {}) => {
      setSearch(
        (previous) => {
          const current = parseExplorerParams(previous)
          const next = typeof patch === 'function' ? patch(current) : patch
          return serializeExplorerParams({ ...current, ...next })
        },
        { replace: options.replace, preventScrollReset: true },
      )
    },
    [setSearch],
  )

  /** Filter change: resets page to 1, keeps the viewport (55:234). */
  const updateFilters = useCallback(
    (patch: Patch) =>
      update((current) => ({ ...(typeof patch === 'function' ? patch(current) : patch), page: 1, sel: null })),
    [update],
  )

  /** href for a card / link that selects a request while keeping everything else. */
  const hrefFor = useCallback(
    (sel: string | null) => {
      const query = serializeExplorerParams({ ...params, sel }).toString()
      return query ? `/requests?${query}` : '/requests'
    },
    [params],
  )

  return { params, update, updateFilters, hrefFor }
}

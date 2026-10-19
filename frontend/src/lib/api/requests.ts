import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { PaginationMeta } from '../../components/ui/Pagination'
import type { SearchQuery } from '../explorer/params'
import type { Province, PublicRequest } from '../request'
import { api, errorStatus } from './client'

export type Paginated<T> = { data: T[]; meta: PaginationMeta }

/** GET /api/requests — live requests only, 30 per page (51:483). */
export async function searchRequests(query: SearchQuery, signal?: AbortSignal): Promise<Paginated<PublicRequest>> {
  const { data } = await api.get<Paginated<PublicRequest>>('/api/requests', { params: query, signal })
  return { data: data.data, meta: data.meta }
}

/** GET /api/requests/{id} — expired/closed stay resolvable; unpublished is 404. */
export async function getRequest(id: string, signal?: AbortSignal): Promise<PublicRequest> {
  const { data } = await api.get<{ data: PublicRequest }>(`/api/requests/${encodeURIComponent(id)}`, { signal })
  return data.data
}

export const requestKeys = {
  all: ['requests'] as const,
  search: (query: SearchQuery) => ['requests', 'search', query] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
}

/**
 * Explorer search (55:191): previous results stay on screen while panning or
 * refetching, so the list never flashes empty.
 */
export function useRequestSearch(query: SearchQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: requestKeys.search(query),
    queryFn: ({ signal }) => searchRequests(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  })
}

/** Seed the detail cache from a list row so the panel opens instantly. */
function fromLists(client: QueryClient, id: string): PublicRequest | undefined {
  for (const [, page] of client.getQueriesData<Paginated<PublicRequest>>({ queryKey: ['requests', 'search'] })) {
    const hit = page?.data.find((r) => r.id === id)
    if (hit) return hit
  }
  return undefined
}

export function useRequestDetail(id: string | null) {
  const client = useQueryClient()
  return useQuery({
    queryKey: requestKeys.detail(id ?? ''),
    queryFn: ({ signal }) => getRequest(id as string, signal),
    enabled: id !== null,
    placeholderData: () => (id ? fromLists(client, id) : undefined),
    staleTime: 30_000,
    retry: (count, error) => errorStatus(error) !== 404 && count < 2,
  })
}

/** POST / DELETE /api/me/saved-requests/{id} (decision #9). Not queued offline (55:359). */
export function useToggleSaved(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (save: boolean) => {
      if (save) await api.post(`/api/me/saved-requests/${encodeURIComponent(id)}`)
      else await api.delete(`/api/me/saved-requests/${encodeURIComponent(id)}`)
      return save
    },
    onSuccess: (saved) => {
      client.setQueryData<PublicRequest>(requestKeys.detail(id), (old) => (old ? { ...old, is_saved: saved } : old))
      void client.invalidateQueries({ queryKey: ['requests', 'search'] })
      void client.invalidateQueries({ queryKey: ['me', 'saved'] })
    },
  })
}

export type PublicStats = {
  active_requests: number
  municipalities: number
  by_blood_type: Record<string, number>
  by_province: Partial<Record<Province, number>>
  is_demo: boolean
}

/** GET /api/stats/public — aggregates only (54:222). */
export function usePublicStats() {
  return useQuery({
    queryKey: ['stats', 'public'],
    queryFn: async ({ signal }) => (await api.get<{ data: PublicStats }>('/api/stats/public', { signal })).data.data,
    staleTime: 5 * 60_000,
  })
}

export type PublicCoordinationPoint = {
  id: number
  name: string
  municipality: string
  province: Province
  /** [lng, lat] — the desk's published location (55:249). */
  point: [number, number]
  is_demo: boolean
}

/** GET /api/coordination-points/public — facility markers. */
export function usePublicCoordinationPoints() {
  return useQuery({
    queryKey: ['coordination-points', 'public'],
    queryFn: async ({ signal }) =>
      (await api.get<{ data: PublicCoordinationPoint[] }>('/api/coordination-points/public', { signal })).data.data,
    staleTime: 10 * 60_000,
  })
}

export type Municipality = {
  id: number
  name: string
  province: Province
  /** [lng, lat] centroid. */
  point: [number, number]
  area: { id: number; name: string; short_name: string }
}

/** GET /api/municipalities — location search suggestions. */
export function useMunicipalities() {
  return useQuery({
    queryKey: ['municipalities'],
    queryFn: async ({ signal }) => (await api.get<{ data: Municipality[] }>('/api/municipalities', { signal })).data.data,
    staleTime: 60 * 60_000,
  })
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationMeta } from '../../components/ui/Pagination'
import { api } from './client'
import type { HistoryEvent, ManagedRequest } from './myRequests'

export const QUEUE_TABS = ['unassigned', 'mine', 'needs_correction', 'all_open'] as const
export type QueueTab = (typeof QUEUE_TABS)[number]
export type ListTab = QueueTab | 'active' | 'closed'
export type QueueCounts = Record<ListTab, number>

export type RecentUpdate = {
  id: number
  request_id: string | null
  action: string
  fields: string[]
  by: 'you' | 'owner' | 'coordinator' | 'system'
  created_at: string
}

export type DayActivity = { date: string; approved: number; correction_requested: number; rejected: number }

export type CoordinatorSummary = {
  area: { id: number; name: string; short_name: string } | null
  pending_review: number
  unassigned: number
  assigned_to_me: number
  needs_correction: number
  all_open: number
  active: number
  expiring_24h: number
  oldest_pending_at: string | null
  needs_review: ManagedRequest[]
  expiring_soon: ManagedRequest[]
  recently_updated: RecentUpdate[]
  activity: DayActivity[]
}

const keys = {
  summary: ['coordinator', 'summary'] as const,
  queue: (tab: ListTab, page: number) => ['coordinator', 'queue', tab, page] as const,
  activity: (filters: ActivityFilters) => ['coordinator', 'activity', filters] as const,
  history: (id: string) => ['coordinator', 'history', id] as const,
}

/** GET /api/coordinator/summary — Overview (35:12) and the sidebar count. */
export function useCoordinatorSummary(enabled = true) {
  return useQuery({
    queryKey: keys.summary,
    queryFn: async ({ signal }) => (await api.get<{ data: CoordinatorSummary }>('/api/coordinator/summary', { signal })).data.data,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** GET /api/coordinator/queue?tab — queue tabs (35:462) and the Active / Closed lists. */
export function useQueue(tab: ListTab, page: number) {
  return useQuery({
    queryKey: keys.queue(tab, page),
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: ManagedRequest[]; meta: PaginationMeta; counts: QueueCounts }>('/api/coordinator/queue', {
          params: { tab, page },
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

/** History plus, for reviewers, the submitter's track record (36:498). */
export function useReviewHistory(id: string) {
  return useQuery({
    queryKey: keys.history(id),
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: HistoryEvent[]; meta: { submitter?: { approved: number; corrections: number } } }>(
          `/api/requests/${encodeURIComponent(id)}/history`,
          { signal },
        )
      ).data,
    staleTime: 10_000,
  })
}

/** Review actions. The server re-checks area, status and assignment (409 when stale). */
export function useReviewAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: 'assign' | 'approve' | 'request-correction' | 'reject'; reason?: string }) =>
      (await api.post<{ data: ManagedRequest }>(`/api/requests/${encodeURIComponent(id)}/${action}`, reason ? { reason } : undefined)).data
        .data,
    onSuccess: (request) => {
      client.setQueryData(['my-requests', 'detail', request.id], request)
      void client.invalidateQueries({ queryKey: ['coordinator'] })
      void client.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export type ActivityFilters = { from?: string; to?: string; actor?: string; action?: string; target?: string; page: number }

export type ActivityRow = {
  id: number
  action: string
  actor: { id: number; name: string; initials: string } | null
  target: string | null
  from: string | null
  to: string | null
  reason: string | null
  fields: string[]
  created_at: string
}

/** GET /api/coordinator/activity — area audit log (36:1105). */
export function useCoordinatorActivity(filters: ActivityFilters) {
  return useQuery({
    queryKey: keys.activity(filters),
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: ActivityRow[]; meta: PaginationMeta & { actors: { id: number; name: string }[]; actions: string[] } }>(
          '/api/coordinator/activity',
          { params: clean(filters), signal },
        )
      ).data,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export async function downloadActivity(filters: Omit<ActivityFilters, 'page'>): Promise<void> {
  const response = await api.get<Blob>('/api/coordinator/activity/export', { params: clean(filters), responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bloodmap-activity.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function clean(filters: object) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
}

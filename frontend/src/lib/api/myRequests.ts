import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationMeta } from '../../components/ui/Pagination'
import type { BloodType, PublicRequest, RequestStatus } from '../request'
import { api } from './client'

export const CATEGORIES = ['scheduled_procedure'] as const
export const CONTACT_METHODS = ['desk_phone', 'desk_email', 'none'] as const
export const CONTACT_VISIBILITIES = ['signed_in', 'public', 'coordinators'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]
export type ContactVisibility = (typeof CONTACT_VISIBILITIES)[number]

/** The request as its owner (or a reviewer) sees it — ManagedRequestResource. */
export type ManagedRequest = Omit<PublicRequest, 'can'> & {
  municipality_id: number
  contact_method: ContactMethod
  contact_visible_to: ContactVisibility
  created_at: string
  submitted_at: string | null
  first_submitted_at: string | null
  extended_at: string | null
  paused: boolean
  correction_note: string | null
  rejection_reason: string | null
  closure_reason: string | null
  /** Owner only: screener flags on the public text, computed live (31:840). */
  privacy_review?: { flags: string[]; duplicate_of: string | null }
  /** Reviewers only: automated checks from submission (36:498). */
  checks?: { flags: string[]; possible_duplicate: boolean }
  /** Reviewers only: the submitter as a reference, never a name. */
  submitter?: { reference: string | null; role: string } | null
  assigned_coordinator: { id: number; name: string; initials: string; is_me: boolean } | null
  can: PublicRequest['can'] & {
    update: boolean
    submit: boolean
    fulfill: boolean
    close: boolean
    extend: boolean
    assign?: boolean
    approve?: boolean
    request_correction?: boolean
    reject?: boolean
  }
}

/** Body of POST /api/requests and PATCH /api/requests/{id} (UpsertBloodRequest). */
export type RequestDraft = {
  blood_type: BloodType
  units_requested: number | null
  needed_by: string | null
  desk_window_start: string | null
  desk_window_end: string | null
  municipality_id: number
  category: string | null
  public_summary: string | null
  coordination_point_id?: number
  contact_method: ContactMethod
  contact_visible_to: ContactVisibility
  response_instructions: string | null
}

export const MINE_TABS = ['all', 'needs_action', 'active', 'closed'] as const
export type MineTab = (typeof MINE_TABS)[number]
export type MineFilters = { q?: string; status?: RequestStatus; blood_type?: BloodType; created_after?: string; tab: MineTab; page: number }
export type MineCounts = Record<MineTab | 'draft', number>

const keys = {
  all: ['my-requests'] as const,
  list: (filters: MineFilters) => ['my-requests', 'list', filters] as const,
  counts: ['my-requests', 'list', 'counts'] as const,
  detail: (id: string) => ['my-requests', 'detail', id] as const,
  history: (id: string) => ['my-requests', 'history', id] as const,
}

/** GET /api/requests/mine — 20 per page with per-tab counts (32:959). */
export function useMyRequests(filters: MineFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async ({ signal }) => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
      const { data } = await api.get<{ data: ManagedRequest[]; meta: PaginationMeta & { counts: MineCounts } }>(
        '/api/requests/mine',
        { params, signal },
      )
      return data
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

/** Sidebar counts (My Requests · Drafts). */
export function useMyRequestCounts(enabled: boolean) {
  return useQuery({
    queryKey: keys.counts,
    queryFn: async ({ signal }) =>
      (await api.get<{ meta: { counts: MineCounts } }>('/api/requests/mine', { signal })).data.meta.counts,
    enabled,
    staleTime: 30_000,
  })
}

export function useManagedRequest(id: string | null) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async ({ signal }) =>
      (await api.get<{ data: ManagedRequest }>(`/api/requests/${encodeURIComponent(id as string)}`, { signal })).data.data,
    enabled: id !== null,
    staleTime: 10_000,
  })
}

export type HistoryEvent = {
  id: number
  action: string
  /** null = System (scheduler). */
  actor: { name: string; is_me: boolean } | null
  from: string | null
  to: string | null
  reason: string | null
  fields: string[]
  created_at: string
}

/** GET /api/requests/{id}/history — read-only, from the audit log (32:1978). */
export function useRequestHistory(id: string) {
  return useQuery({
    queryKey: keys.history(id),
    queryFn: async ({ signal }) =>
      (await api.get<{ data: HistoryEvent[] }>(`/api/requests/${encodeURIComponent(id)}/history`, { signal })).data.data,
    staleTime: 10_000,
  })
}

export type OwnCoordinationPoint = {
  id: number
  name: string
  hours: string | null
  municipality: { id: number; name: string; province: string }
  has_phone: boolean
  has_email: boolean
  is_demo: boolean
}

/** GET /api/coordination-points — a submitter only gets their authorized desk. */
export function useOwnCoordinationPoints() {
  return useQuery({
    queryKey: ['coordination-points', 'own'],
    queryFn: async ({ signal }) => (await api.get<{ data: OwnCoordinationPoint[] }>('/api/coordination-points', { signal })).data.data,
    staleTime: 5 * 60_000,
  })
}

function useRequestMutation<TVars>(fn: (vars: TVars) => Promise<ManagedRequest>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (request) => {
      client.setQueryData(keys.detail(request.id), request)
      void client.invalidateQueries({ queryKey: ['my-requests', 'list'] })
      void client.invalidateQueries({ queryKey: keys.history(request.id) })
      void client.invalidateQueries({ queryKey: ['requests'] })
      void client.invalidateQueries({ queryKey: ['coordinator'] })
    },
  })
}

const post = async (path: string, body?: object) => (await api.post<{ data: ManagedRequest }>(path, body)).data.data
const at = (id: string, action = '') => `/api/requests/${encodeURIComponent(id)}${action}`

/** Save draft: POST creates, PATCH updates (decision #7). */
export function useSaveDraft() {
  return useRequestMutation(async ({ id, values }: { id: string | null; values: Partial<RequestDraft> }) =>
    id ? (await api.patch<{ data: ManagedRequest }>(at(id), values)).data.data : post('/api/requests', values),
  )
}

export function useSubmitRequest() {
  return useRequestMutation((id: string) => post(at(id, '/submit')))
}

export function useFulfillRequest() {
  return useRequestMutation((id: string) => post(at(id, '/fulfill')))
}

export function useCloseRequest() {
  return useRequestMutation(({ id, reason }: { id: string; reason: string }) => post(at(id, '/close'), { reason }))
}

export function useExtendRequest() {
  return useRequestMutation((id: string) => post(at(id, '/extend')))
}

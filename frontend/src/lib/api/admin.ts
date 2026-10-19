import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationMeta } from '../../components/ui/Pagination'
import type { RequestStatus } from '../request'
import type { Role } from './auth'
import { api } from './client'

export type AdminSummary = {
  days: 7 | 30 | 90
  from: string
  to: string
  accounts: { total: number; new: number }
  active: { total: number; municipalities: number }
  pending: { total: number; median_wait_minutes: number | null }
  expired: { total: number; previous: number }
  series: { date: string; created: number; expired: number }[]
  statuses: Partial<Record<RequestStatus, number>>
  municipalities: { id: number; name: string | null; province: string | null; requests: number; coordinators: number }[]
  recent: { id: number; action: string; target: string | null; from: string | null; to: string | null; actor: string | null; created_at: string }[]
}

export type AccountStatus = 'active' | 'unverified' | 'restricted'

export type AdminUser = {
  id: number
  name: string
  email: string
  initials: string
  role: Role
  reference: string | null
  area: { id: number; name: string; short_name: string } | null
  coordination_point: { id: number; name: string } | null
  email_verified: boolean
  restricted: boolean
  status: AccountStatus
  pending_role_change: { id: number; to_role: Role; requested_by: number } | null
  last_active_at: string | null
  created_at: string
  is_demo: boolean
}

export type AdminUserDetail = AdminUser & {
  area_municipalities: number | null
  last_sign_in: { at: string; device: string | null } | null
  reviews_30d: { approved: number; corrections: number; rejected: number } | null
  restriction_reason: string | null
}

export type UserFilters = { q?: string; role?: Role; status?: AccountStatus; area_id?: string; page: number }

export type CoordinatorRow = {
  id: number
  name: string
  email: string
  initials: string
  area: { id: number; name: string; short_name: string } | null
  restricted: boolean
  email_verified: boolean
  last_active_at: string | null
  reviews_30d: { approved: number; corrections: number; rejected: number }
  is_demo: boolean
}

export type AuditRow = {
  id: number
  created_at: string
  actor: { id: number; name: string; role: Role } | null
  initials: string | null
  action: string
  target: string | null
  resource: string
  from: string | null
  to: string | null
  reason: string | null
  meta: { fields?: string[]; device?: string; paused_requests?: number; count?: number; changes?: Record<string, unknown> }
}

export type AuditFilters = { from?: string; to?: string; actor?: string; action?: string; resource?: string; page: number }

export type AdminSettings = {
  expiry: { default: string; default_window_end: string; max_extension_hours: number; reminder_hours: number; job_frequency_minutes: number }
  notifications: { owner_decisions: boolean; saver_updates: string; weekly_digest: boolean }
  general: { platform_name: string; timezone: string; default_map_area: string }
  retention: { deleted_accounts_days: number; deactivated_accounts_days: number; inactive_saved_days: number; location_precision: string }
  health: {
    api: { status: HealthStatus }
    database: { status: HealthStatus; latency_ms: number | null }
    queue: { status: HealthStatus; failed_24h: number | null; driver: string }
    mail: { status: HealthStatus; driver: string }
  }
  version: { api: string; laravel: string; php: string }
}
export type HealthStatus = 'operational' | 'degraded' | 'down'

const clean = (filters: object) => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))

export function useAdminSummary(days: 7 | 30 | 90) {
  return useQuery({
    queryKey: ['admin', 'summary', days],
    queryFn: async ({ signal }) => (await api.get<{ data: AdminSummary }>('/api/admin/summary', { params: { days }, signal })).data.data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useAdminUsers(filters: UserFilters) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: async ({ signal }) =>
      (await api.get<{ data: AdminUser[]; meta: PaginationMeta }>('/api/admin/users', { params: clean(filters), signal })).data,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useAdminUser(id: number | null) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: async ({ signal }) => (await api.get<{ data: AdminUserDetail }>(`/api/admin/users/${id}`, { signal })).data.data,
    enabled: id !== null,
  })
}

/** Role change, restriction, reset email and role-change decisions. Every one is audited server-side. */
export function useAdminUserAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (
      action:
        | { kind: 'role'; id: number; role: Role; area_id?: number | null; coordination_point_id?: number | null; reason: string }
        | { kind: 'restrict' | 'unrestrict'; id: number; reason: string }
        | { kind: 'reset'; id: number }
        | { kind: 'approve' | 'decline'; id: number; changeId: number },
    ) => {
      switch (action.kind) {
        case 'role': {
          const { id, kind: _kind, ...body } = action
          void _kind
          const response = await api.patch<{ data: AdminUser }>(`/api/admin/users/${id}/role`, body)
          return { pending: response.status === 202, user: response.data.data }
        }
        case 'restrict':
        case 'unrestrict':
          return { pending: false, user: (await api.post<{ data: AdminUser }>(`/api/admin/users/${action.id}/${action.kind}`, { reason: action.reason })).data.data }
        case 'reset':
          await api.post(`/api/admin/users/${action.id}/password-reset`)
          return { pending: false, user: null }
        case 'approve':
        case 'decline':
          return { pending: false, user: (await api.post<{ data: AdminUser }>(`/api/admin/role-changes/${action.changeId}/${action.kind}`)).data.data }
      }
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useAdminCoordinators() {
  return useQuery({
    queryKey: ['admin', 'coordinators'],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: CoordinatorRow[]; meta: { uncovered_areas: { id: number; name: string; short_name: string }[] } }>(
          '/api/admin/coordinators',
          { signal },
        )
      ).data,
    staleTime: 30_000,
  })
}

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: AuditRow[]; meta: PaginationMeta & { actors: { id: number; name: string }[] } }>('/api/admin/audit-logs', {
          params: clean(filters),
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async ({ signal }) => (await api.get<{ data: AdminSettings }>('/api/admin/settings', { signal })).data.data,
  })
}

/** CSV downloads go through the API client so the session cookie and CSRF rules apply. */
export async function downloadCsv(path: string, params: object, filename: string): Promise<void> {
  const response = await api.get<Blob>(path, { params: clean(params), responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

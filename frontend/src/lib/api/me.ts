import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationMeta } from '../../components/ui/Pagination'
import type { BloodType, PublicRequest, RequestStatus } from '../request'
import { meKey, type Me } from './auth'
import { api } from './client'

/** GET /api/me/saved-requests — active first, inactive kept for 30 days (28:856). */
export function useSavedRequests(enabled = true) {
  return useQuery({
    queryKey: ['me', 'saved'],
    queryFn: async ({ signal }) => (await api.get<{ data: PublicRequest[] }>('/api/me/saved-requests', { signal })).data.data,
    enabled,
    staleTime: 30_000,
  })
}

export function useUnsave() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/me/saved-requests/${encodeURIComponent(id)}`)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['me'] })
      void client.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export type NotificationKind = 'approved' | 'needs_correction' | 'rejected' | 'status_changed' | 'expired' | 'expiring_soon'

/** In-app updates (decision #21). */
export type AppNotification = {
  id: string
  kind: NotificationKind
  request_id: string
  status: RequestStatus
  blood_type: BloodType
  municipality: string | null
  expires_at: string | null
  read: boolean
  created_at: string
}

export function useNotifications(page = 1) {
  return useQuery({
    queryKey: ['me', 'notifications', page],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: AppNotification[]; meta: PaginationMeta & { unread: number } }>(
          '/api/me/notifications',
          { params: { page }, signal },
        )
      ).data,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useMarkNotificationsRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/api/me/notifications/read')
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['me', 'notifications'] }),
  })
}

export const ACTIVITY_GROUPS = ['saved', 'preferences', 'sign_ins', 'account', 'requests'] as const
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]

export type ActivityItem = {
  id: number
  action: string
  request: string | null
  request_status: RequestStatus | null
  from: string | null
  to: string | null
  device: string | null
  changes: Record<string, boolean> | null
  created_at: string
}

export type ActivityQuery = { group?: ActivityGroup; from?: string; to?: string; page?: number }

/** GET /api/me/activity (29:625). */
export function useActivity(query: ActivityQuery) {
  return useQuery({
    queryKey: ['me', 'activity', query],
    queryFn: async ({ signal }) =>
      (await api.get<{ data: ActivityItem[]; meta: PaginationMeta }>('/api/me/activity', { params: query, signal })).data,
    placeholderData: keepPreviousData,
  })
}

/** "Download my data" — a JSON file built by the API. */
export async function downloadMyData(): Promise<void> {
  const response = await api.get<Blob>('/api/me/export', { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bloodmap-my-data.json'
  link.click()
  URL.revokeObjectURL(url)
}

export type Session = { id: string; device: string | null; last_active_at: string; current: boolean }

export function useSessions() {
  return useQuery({
    queryKey: ['me', 'sessions'],
    queryFn: async ({ signal }) => (await api.get<{ data: Session[] }>('/api/me/sessions', { signal })).data.data,
  })
}

export function useEndSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/me/sessions/${encodeURIComponent(id)}`)
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  })
}

function useMeMutation<T>(request: (input: T) => Promise<Me>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (me) => {
      client.setQueryData(meKey, me)
      void client.invalidateQueries({ queryKey: ['me', 'activity'] })
    },
  })
}

/** PATCH /api/me/preferences — instant-apply switches (29:1141). */
export function useUpdatePreferences() {
  return useMeMutation(async (changes: Record<string, boolean>) => (await api.patch<{ data: Me }>('/api/me/preferences', changes)).data.data)
}

/** PATCH /api/me — "Edit account details". */
export function useUpdateAccount() {
  return useMeMutation(async (input: { name: string; email: string }) => (await api.patch<{ data: Me }>('/api/me', input)).data.data)
}

export function useUpdatePassword() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { current_password: string; password: string; password_confirmation: string }) => {
      await api.put('/api/me/password', input)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: meKey })
      void client.invalidateQueries({ queryKey: ['me', 'sessions'] })
    },
  })
}

/** Deactivate / request deletion both end the session; the caller navigates away. */
export function useCloseAccount() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { mode: 'deactivate' } | { mode: 'delete'; confirmation: string }) => {
      if (input.mode === 'deactivate') await api.post('/api/me/deactivate')
      else await api.delete('/api/me', { data: { confirmation: input.confirmation } })
    },
    onSuccess: () => {
      client.setQueryData(meKey, null)
      client.removeQueries({ predicate: (q) => q.queryKey[0] === 'me' && q.queryKey.length > 1 })
    },
  })
}

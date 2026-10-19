import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorStatus } from './client'

export type Role = 'donor' | 'facility_submitter' | 'coordinator' | 'admin'

/** GET /api/me — the nav is rendered from `permissions` (51:298). */
export type Me = {
  id: number
  name: string
  email: string
  initials: string
  email_verified: boolean
  role: Role
  reference: string | null
  area: { id: number; name: string; short_name: string } | null
  coordination_point: { id: number; name: string } | null
  preferences: Record<string, boolean>
  permissions: string[]
  member_since: string | null
  password_changed_at: string | null
  is_demo: boolean
}

/** Landing route after sign-in, by role (decision #34). */
export function homeFor(me: Pick<Me, 'role'>): string {
  switch (me.role) {
    case 'coordinator':
      return '/coord'
    case 'admin':
      return '/admin'
    case 'facility_submitter':
      return '/requests/mine'
    default:
      return '/app'
  }
}

export const meKey = ['me'] as const

/** Signed-in user, or null for guests (401 is an answer, not an error). */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async ({ signal }) => {
      try {
        return (await api.get<{ data: Me }>('/api/me', { signal })).data.data
      } catch (error) {
        if (errorStatus(error) === 401 || errorStatus(error) === 403) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export type LoginInput = { email: string; password: string; remember: boolean }

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => (await api.post<{ data: Me }>('/login', input)).data.data,
    onSuccess: (me) => {
      client.setQueryData(meKey, me)
      // Contact visibility and saved flags depend on the session.
      void client.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/logout')
    },
    onSuccess: () => {
      client.setQueryData(meKey, null)
      client.removeQueries({ predicate: (query) => query.queryKey[0] === 'me' && query.queryKey.length > 1 })
      void client.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export type RegisterInput = {
  name: string
  email: string
  password: string
  password_confirmation: string
  terms: boolean
  email_saved_status_changes: boolean
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      await api.post('/register', input)
    },
  })
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post('/email/verification-notification', { email })
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post('/forgot-password', { email })
    },
  })
}

export type ResetPasswordInput = { token: string; email: string; password: string; password_confirmation: string }

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      await api.post('/reset-password', input)
    },
  })
}

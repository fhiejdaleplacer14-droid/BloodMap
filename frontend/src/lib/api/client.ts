import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios'

/**
 * Sanctum SPA cookie auth (54:244): the session cookie and XSRF-TOKEN travel
 * with every request; mutating calls first make sure the CSRF cookie exists.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
})

let csrf: Promise<unknown> | null = null

/** GET /sanctum/csrf-cookie once per page load (again after a 419). */
export function ensureCsrfCookie(): Promise<unknown> {
  csrf ??= api.get('/sanctum/csrf-cookie').catch((error: unknown) => {
    csrf = null
    throw error
  })
  return csrf
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete'])

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (MUTATING.has((config.method ?? 'get').toLowerCase()) && config.url !== '/sanctum/csrf-cookie') {
    await ensureCsrfCookie()
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

// 419 = CSRF token mismatch (e.g. the session rotated): refresh once and retry.
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (isAxiosError(error) && error.response?.status === 419 && error.config) {
    const config = error.config as RetriableConfig
    if (!config._csrfRetried) {
      config._csrfRetried = true
      csrf = null
      await ensureCsrfCookie()
      return api.request(config)
    }
  }
  throw error
})

/** Laravel error body: validation (422), custom `code`s (429 locked_out, 403 account_restricted …). */
export type ApiErrorBody = {
  message?: string
  code?: string
  errors?: Record<string, string[]>
  retry_after?: number
}

export function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

export function errorBody(error: unknown): ApiErrorBody | undefined {
  return isAxiosError(error) ? (error.response?.data as ApiErrorBody | undefined) : undefined
}

/** True when the request never reached the API (offline, DNS, CORS, server down). */
export function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response
}

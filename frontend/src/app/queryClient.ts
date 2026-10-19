import { QueryClient } from '@tanstack/react-query'
import { errorStatus } from '../lib/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx answers are final; network and 5xx errors get two quiet retries.
      retry: (count, error) => {
        const status = errorStatus(error)
        if (status !== undefined && status >= 400 && status < 500) return false
        return count < 2
      },
      refetchOnWindowFocus: false,
      // "We'll retry automatically when your connection returns." (19:1852)
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations are never queued offline (55:359).
      networkMode: 'always',
    },
  },
})

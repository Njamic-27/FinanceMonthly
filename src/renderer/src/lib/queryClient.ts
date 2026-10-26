import { QueryClient } from '@tanstack/react-query'

// Data only changes through this app's own mutations, which update or invalidate the cache,
// so there's no need to refetch on focus or after a timeout. Local IPC failures don't heal
// on retry, so errors surface immediately.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false
    },
    mutations: {
      retry: false
    }
  }
})

import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api/api-error'

/**
 * Server-state defaults for the whole app. Per-query overrides are the
 * exception and must say why in a comment (docs/FRONTEND_ENGINEERING_STANDARDS.md
 * "Queries").
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Billing data is edited by several people at once, so "fresh" is
        // short. It is not zero: a tab switch should not refetch a table the
        // user looked at two seconds ago.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // Retrying a 403 or a 404 only delays the error the user needs to see.
        retry: (failureCount, error) => isApiError(error) && error.isRetryable && failureCount < 2,
        refetchOnWindowFocus: false,
        // A claim list that silently refetches while someone is reading a row
        // is worse than a slightly stale list; screens that need live data ask
        // for it explicitly.
        refetchOnReconnect: true,
      },
      mutations: {
        // Money-moving requests are never retried automatically: a retried
        // "post payment" can post twice. Retry is the user's decision.
        retry: false,
      },
    },
  })
}

/** The instance used by the running app. Tests create their own per test. */
export const queryClient = createQueryClient()

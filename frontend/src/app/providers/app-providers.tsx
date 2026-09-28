import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { queryClient as appQueryClient } from '@/lib/query/query-client'

/**
 * Every provider the app needs, in one place, so a test can render the same
 * tree with its own QueryClient. Keep this list short: a provider here is a
 * dependency of every screen and every test.
 */
export function AppProviders({
  children,
  queryClient = appQueryClient,
}: {
  children: ReactNode
  queryClient?: QueryClient
}) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { AppProviders } from '@/app/providers/app-providers'

/**
 * Render a component inside the app's providers. Every test gets its own
 * QueryClient so one test's cache can never explain another test's result,
 * and retries are off so a failing request fails the test immediately instead
 * of after three attempts.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient } = {},
): RenderResult & { queryClient: QueryClient } {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options
  const result = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AppProviders queryClient={queryClient}>{children}</AppProviders>
    ),
    ...renderOptions,
  })
  return { ...result, queryClient }
}

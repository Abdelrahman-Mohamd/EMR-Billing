import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProvider, listProviders, updateProvider } from '../api/providers-api'
import type { ProviderFormValues } from '../schemas/provider'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const providerKeys = {
  all: ['providers'] as const,
  list: () => [...providerKeys.all, 'list'] as const,
}

export function useProviders() {
  return useQuery({
    queryKey: providerKeys.list(),
    queryFn: ({ signal }) => listProviders(signal),
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProviderFormValues) => createProvider(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerKeys.all }),
  })
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ProviderFormValues }) => updateProvider(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerKeys.all }),
  })
}

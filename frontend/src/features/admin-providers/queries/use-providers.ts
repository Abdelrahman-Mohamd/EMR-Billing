import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  correctProviderNpi,
  createProvider,
  deleteProvider,
  getProvider,
  listProviders,
  setProviderActive,
  updateProvider,
} from '../api/providers-api'
import type { Provider, ProviderFormValues } from '../schemas/provider'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const providerKeys = {
  all: ['providers'] as const,
  list: () => [...providerKeys.all, 'list'] as const,
  detail: (id: number) => [...providerKeys.all, 'detail', id] as const,
}

export function useProviders() {
  return useQuery({
    queryKey: providerKeys.list(),
    queryFn: ({ signal }) => listProviders(signal),
  })
}

/** One provider as they are now, for the edit form; `null` asks for nothing (a new one). */
export function useProvider(id: number | null) {
  return useQuery({
    queryKey: providerKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getProvider(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

function useInvalidateProviders() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: providerKeys.all })
}

export function useCreateProvider() {
  const invalidate = useInvalidateProviders()
  return useMutation({
    mutationFn: (values: ProviderFormValues) => createProvider(values),
    onSuccess: invalidate,
  })
}

export function useUpdateProvider() {
  const invalidate = useInvalidateProviders()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ProviderFormValues }) => updateProvider(id, values),
    onSuccess: invalidate,
  })
}

/** Exceptions: a missing or placeholder rendering NPI corrected on the provider — the NPI alone. */
export function useCorrectProviderNpi() {
  const invalidate = useInvalidateProviders()
  return useMutation({
    mutationFn: ({ id, npi }: { id: number; npi: string }) => correctProviderNpi(id, npi),
    onSuccess: invalidate,
  })
}

/**
 * The row's Active switch, once confirmed. When the server has saved it, the
 * new status is written into the cached list at once — the switch shows it as
 * the dialog closes — and the list is read again in the background.
 */
export function useSetProviderActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setProviderActive(id, isActive),
    onSuccess: (_message, { id, isActive }) => {
      queryClient.setQueryData<Provider[]>(providerKeys.list(), (providers) =>
        providers?.map((provider) => (provider.id === id ? { ...provider, isActive } : provider)),
      )
      void queryClient.invalidateQueries({ queryKey: providerKeys.all })
    },
  })
}

export function useDeleteProvider() {
  const invalidate = useInvalidateProviders()
  return useMutation({
    mutationFn: (id: number) => deleteProvider(id),
    onSuccess: invalidate,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAuthorization,
  deleteAuthorization,
  listAuthorizations,
  updateAuthorization,
} from '../api/authorizations-api'
import type { AuthorizationPayload, AuthorizationUpdatePayload } from '../schemas/authorization'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const authorizationKeys = {
  all: ['authorizations'] as const,
  list: () => [...authorizationKeys.all, 'list'] as const,
}

export function useAuthorizations() {
  return useQuery({
    queryKey: authorizationKeys.list(),
    queryFn: ({ signal }) => listAuthorizations(signal),
  })
}

function useInvalidateAuthorizations() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: authorizationKeys.all })
}

export function useCreateAuthorization() {
  const invalidate = useInvalidateAuthorizations()
  return useMutation({
    mutationFn: (payload: AuthorizationPayload) => createAuthorization(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateAuthorization() {
  const invalidate = useInvalidateAuthorizations()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AuthorizationUpdatePayload }) =>
      updateAuthorization(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteAuthorization() {
  const invalidate = useInvalidateAuthorizations()
  return useMutation({
    mutationFn: (id: string) => deleteAuthorization(id),
    onSuccess: invalidate,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClaim, listClaims } from '../api/claims-api'
import type { CreateClaimPayload } from '../schemas/claim'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const claimKeys = {
  all: ['claims'] as const,
  list: () => [...claimKeys.all, 'list'] as const,
}

export function useClaims() {
  return useQuery({ queryKey: claimKeys.list(), queryFn: ({ signal }) => listClaims(signal) })
}

export function useCreateClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateClaimPayload) => createClaim(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claimKeys.all }),
  })
}

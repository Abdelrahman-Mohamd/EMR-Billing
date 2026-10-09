import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClaim, deleteClaim, listClaims, updateClaim } from '../api/claims-api'
import type { CreateClaimPayload, UpdateClaimPayload } from '../schemas/claim'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const claimKeys = {
  all: ['claims'] as const,
  list: () => [...claimKeys.all, 'list'] as const,
}

/** Every claim. Read again on each visit to a screen: their status moves on. */
export function useClaims() {
  return useQuery({ queryKey: claimKeys.list(), queryFn: ({ signal }) => listClaims(signal), staleTime: 0 })
}

function useInvalidateClaims() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: claimKeys.all })
}

export function useCreateClaim() {
  const invalidate = useInvalidateClaims()
  return useMutation({
    mutationFn: (payload: CreateClaimPayload) => createClaim(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateClaim() {
  const invalidate = useInvalidateClaims()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateClaimPayload }) => updateClaim(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteClaim() {
  const invalidate = useInvalidateClaims()
  return useMutation({
    mutationFn: (id: number) => deleteClaim(id),
    onSuccess: invalidate,
  })
}

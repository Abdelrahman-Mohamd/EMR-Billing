import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addChargeLine, createVisit, listVisits } from '../api/visits-api'
import type { CreateChargeLinePayload, CreateVisitPayload } from '../schemas/visit'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const visitKeys = {
  all: ['visits'] as const,
  list: () => [...visitKeys.all, 'list'] as const,
}

export function useVisits() {
  return useQuery({ queryKey: visitKeys.list(), queryFn: ({ signal }) => listVisits(signal) })
}

export function useCreateVisit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateVisitPayload) => createVisit(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: visitKeys.all }),
  })
}

export function useAddChargeLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateChargeLinePayload) => addChargeLine(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: visitKeys.all }),
  })
}

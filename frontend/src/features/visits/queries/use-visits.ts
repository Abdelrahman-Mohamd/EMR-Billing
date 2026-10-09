import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authorizationKeys } from '@/features/patients'
import { createVisit, deleteVisit, getVisit, listVisits, releaseVisit, updateVisit } from '../api/visits-api'
import { addChargeLine, deleteChargeLine, updateChargeLine } from '../api/charge-lines-api'
import type { ChargeLinePayload, ChargeLineUpdatePayload } from '../schemas/charge-line'
import type { CreateVisitPayload, UpdateVisitPayload } from '../schemas/visit'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const visitKeys = {
  all: ['visits'] as const,
  list: () => [...visitKeys.all, 'list'] as const,
  detail: (id: number) => [...visitKeys.all, 'detail', id] as const,
}

/** Every visit. Read again on each visit to a screen: deleting a patient or case takes their visits with it. */
export function useVisits() {
  return useQuery({ queryKey: visitKeys.list(), queryFn: ({ signal }) => listVisits(signal), staleTime: 0 })
}

/** One visit, read on its own, as it stands now. */
export function useVisit(id: number) {
  return useQuery({
    queryKey: visitKeys.detail(id),
    queryFn: ({ signal }) => getVisit(id, signal),
    staleTime: 0,
  })
}

/**
 * After a visit changes: the visits, and the authorizations (a release uses
 * one; a save can change which).
 */
function useInvalidateVisits() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: visitKeys.all }),
      queryClient.invalidateQueries({ queryKey: authorizationKeys.all }),
    ])
}

export function useCreateVisit() {
  const invalidate = useInvalidateVisits()
  return useMutation({
    mutationFn: (payload: CreateVisitPayload) => createVisit(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateVisit() {
  const invalidate = useInvalidateVisits()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateVisitPayload }) => updateVisit(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteVisit() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateVisits()
  return useMutation({
    mutationFn: (id: number) => deleteVisit(id),
    onSuccess: (_message, id) => {
      // The page that showed it is gone; do not read it again.
      queryClient.removeQueries({ queryKey: visitKeys.detail(id) })
      return invalidate()
    },
  })
}

export function useReleaseVisit() {
  const invalidate = useInvalidateVisits()
  return useMutation({
    mutationFn: (id: number) => releaseVisit(id),
    onSuccess: invalidate,
  })
}

/** A visit's lines change its total: the visits are read again. */
function useInvalidateVisitsOnly() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: visitKeys.all })
}

export function useAddChargeLine() {
  const invalidate = useInvalidateVisitsOnly()
  return useMutation({
    mutationFn: (payload: ChargeLinePayload) => addChargeLine(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateChargeLine() {
  const invalidate = useInvalidateVisitsOnly()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ChargeLineUpdatePayload }) =>
      updateChargeLine(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteChargeLine() {
  const invalidate = useInvalidateVisitsOnly()
  return useMutation({
    mutationFn: (id: number) => deleteChargeLine(id),
    onSuccess: invalidate,
  })
}

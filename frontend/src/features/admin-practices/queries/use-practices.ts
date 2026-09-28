import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createLocation,
  createPractice,
  listPractices,
  updateLocation,
  updatePractice,
} from '../api/practices-api'
import type { LocationFormValues, NewPracticeFormValues, PracticeFormValues } from '../schemas/practice-form'

/**
 * Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5).
 * A practice carries its locations, so a location change refreshes the list.
 */
export const practiceKeys = {
  all: ['practices'] as const,
  list: () => [...practiceKeys.all, 'list'] as const,
}

export function usePractices() {
  return useQuery({
    queryKey: practiceKeys.list(),
    queryFn: ({ signal }) => listPractices(signal),
  })
}

function useInvalidatePractices() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: practiceKeys.all })
}

export function useCreatePractice() {
  const invalidate = useInvalidatePractices()
  return useMutation({
    mutationFn: (values: NewPracticeFormValues) => createPractice(values),
    onSuccess: invalidate,
  })
}

export function useUpdatePractice() {
  const invalidate = useInvalidatePractices()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: PracticeFormValues }) => updatePractice(id, values),
    onSuccess: invalidate,
  })
}

export function useCreateLocation() {
  const invalidate = useInvalidatePractices()
  return useMutation({
    mutationFn: ({ practiceId, values }: { practiceId: number; values: LocationFormValues }) =>
      createLocation(practiceId, values),
    onSuccess: invalidate,
  })
}

export function useUpdateLocation() {
  const invalidate = useInvalidatePractices()
  return useMutation({
    mutationFn: ({
      id,
      practiceId,
      values,
    }: {
      id: number
      practiceId: number
      values: LocationFormValues
    }) => updateLocation(id, practiceId, values),
    onSuccess: invalidate,
  })
}

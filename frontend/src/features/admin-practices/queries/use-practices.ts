import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createLocation,
  createPractice,
  deleteLocation,
  deletePractice,
  getPractice,
  listLocations,
  listPractices,
  setLocationActive,
  updateLocation,
  updatePractice,
} from '../api/practices-api'
import type { LocationFormValues, NewPracticeFormValues, PracticeFormValues } from '../schemas/practice-form'

/**
 * Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5).
 * The lists hold summaries; a practice's details and locations are its own
 * record. Any change refreshes all of them.
 */
export const practiceKeys = {
  all: ['practices'] as const,
  list: () => [...practiceKeys.all, 'list'] as const,
  detail: (id: number) => [...practiceKeys.all, 'detail', id] as const,
  locations: () => [...practiceKeys.all, 'locations'] as const,
}

/** Every practice, as summaries: to pick one, or to name one. */
export function usePractices() {
  return useQuery({
    queryKey: practiceKeys.list(),
    queryFn: ({ signal }) => listPractices(signal),
  })
}

/** One practice in full, with its locations; `null` asks for nothing. */
export function usePractice(id: number | null) {
  return useQuery({
    queryKey: practiceKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getPractice(id ?? 0, signal),
    enabled: id !== null,
  })
}

/** Every location of every practice, as summaries: to pick one, or to name one. */
export function useLocations() {
  return useQuery({
    queryKey: practiceKeys.locations(),
    queryFn: ({ signal }) => listLocations(signal),
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

export function useDeletePractice() {
  const invalidate = useInvalidatePractices()
  return useMutation({
    mutationFn: (id: number) => deletePractice(id),
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
    mutationFn: ({ id, values }: { id: number; values: LocationFormValues }) => updateLocation(id, values),
    onSuccess: invalidate,
  })
}

export function useSetLocationActive() {
  const invalidate = useInvalidatePractices()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setLocationActive(id, isActive),
    onSuccess: invalidate,
  })
}

export function useDeleteLocation() {
  const invalidate = useInvalidatePractices()
  return useMutation({
    mutationFn: (id: number) => deleteLocation(id),
    onSuccess: invalidate,
  })
}

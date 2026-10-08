import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  correctReferringPhysicianNpi,
  createReferringPhysician,
  deleteReferringPhysician,
  getReferringPhysician,
  listReferringPhysicians,
  setReferringPhysicianActive,
  updateReferringPhysician,
} from '../api/referring-physicians-api'
import type { ReferringPhysician, ReferringPhysicianFormValues } from '../schemas/referring-physician'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const referringPhysicianKeys = {
  all: ['referring-physicians'] as const,
  list: () => [...referringPhysicianKeys.all, 'list'] as const,
  detail: (id: number) => [...referringPhysicianKeys.all, 'detail', id] as const,
}

export function useReferringPhysicians() {
  return useQuery({
    queryKey: referringPhysicianKeys.list(),
    queryFn: ({ signal }) => listReferringPhysicians(signal),
  })
}

/** One physician as they are now, for the edit form; `null` asks for nothing (a new one). */
export function useReferringPhysician(id: number | null) {
  return useQuery({
    queryKey: referringPhysicianKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getReferringPhysician(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

function useInvalidateReferringPhysicians() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: referringPhysicianKeys.all })
}

export function useCreateReferringPhysician() {
  const invalidate = useInvalidateReferringPhysicians()
  return useMutation({
    mutationFn: (values: ReferringPhysicianFormValues) => createReferringPhysician(values),
    onSuccess: invalidate,
  })
}

export function useUpdateReferringPhysician() {
  const invalidate = useInvalidateReferringPhysicians()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ReferringPhysicianFormValues }) =>
      updateReferringPhysician(id, values),
    onSuccess: invalidate,
  })
}

/** Exceptions: a placeholder NPI corrected on the directory profile — the NPI alone. */
export function useCorrectReferringPhysicianNpi() {
  const invalidate = useInvalidateReferringPhysicians()
  return useMutation({
    mutationFn: ({ id, npi }: { id: number; npi: string }) => correctReferringPhysicianNpi(id, npi),
    onSuccess: invalidate,
  })
}

/**
 * The row's Active switch, once confirmed. When the server has saved it, the
 * new status is written into the cached list at once — the switch shows it as
 * the dialog closes — and the list is read again in the background.
 */
export function useSetReferringPhysicianActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setReferringPhysicianActive(id, isActive),
    onSuccess: (_message, { id, isActive }) => {
      queryClient.setQueryData<ReferringPhysician[]>(referringPhysicianKeys.list(), (physicians) =>
        physicians?.map((physician) => (physician.id === id ? { ...physician, isActive } : physician)),
      )
      void queryClient.invalidateQueries({ queryKey: referringPhysicianKeys.all })
    },
  })
}

export function useDeleteReferringPhysician() {
  const invalidate = useInvalidateReferringPhysicians()
  return useMutation({
    mutationFn: (id: number) => deleteReferringPhysician(id),
    onSuccess: invalidate,
  })
}

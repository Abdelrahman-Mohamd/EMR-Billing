import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReferringPhysician,
  listReferringPhysicians,
  updateReferringPhysician,
} from '../api/referring-physicians-api'
import type { ReferringPhysicianFormValues } from '../schemas/referring-physician'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const referringPhysicianKeys = {
  all: ['referring-physicians'] as const,
  list: () => [...referringPhysicianKeys.all, 'list'] as const,
}

export function useReferringPhysicians() {
  return useQuery({
    queryKey: referringPhysicianKeys.list(),
    queryFn: ({ signal }) => listReferringPhysicians(signal),
  })
}

export function useCreateReferringPhysician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ReferringPhysicianFormValues) => createReferringPhysician(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: referringPhysicianKeys.all }),
  })
}

export function useUpdateReferringPhysician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ReferringPhysicianFormValues }) =>
      updateReferringPhysician(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: referringPhysicianKeys.all }),
  })
}

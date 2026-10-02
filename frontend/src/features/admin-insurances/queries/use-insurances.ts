import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInsuranceClass,
  listInsuranceClasses,
  updateInsuranceClass,
} from '../api/insurance-classes-api'
import { createInsurance, listInsurances, updateInsurance } from '../api/insurances-api'
import type { InsuranceFormValues } from '../schemas/insurance'
import type { InsuranceClassFormValues } from '../schemas/insurance-class'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const insuranceClassKeys = {
  all: ['insurance-classes'] as const,
  list: () => [...insuranceClassKeys.all, 'list'] as const,
}
export const insuranceKeys = {
  all: ['insurances'] as const,
  list: () => [...insuranceKeys.all, 'list'] as const,
}

export function useInsuranceClasses() {
  return useQuery({
    queryKey: insuranceClassKeys.list(),
    queryFn: ({ signal }) => listInsuranceClasses(signal),
  })
}

export function useCreateInsuranceClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: InsuranceClassFormValues) => createInsuranceClass(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: insuranceClassKeys.all }),
  })
}

export function useUpdateInsuranceClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: InsuranceClassFormValues }) =>
      updateInsuranceClass(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: insuranceClassKeys.all }),
  })
}

export function useInsurances() {
  return useQuery({
    queryKey: insuranceKeys.list(),
    queryFn: ({ signal }) => listInsurances(signal),
  })
}

export function useCreateInsurance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: InsuranceFormValues) => createInsurance(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: insuranceKeys.all }),
  })
}

export function useUpdateInsurance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: InsuranceFormValues }) => updateInsurance(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: insuranceKeys.all }),
  })
}

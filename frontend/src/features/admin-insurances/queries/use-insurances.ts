import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInsuranceClass,
  deleteInsuranceClass,
  getInsuranceClass,
  listInsuranceClasses,
  setInsuranceClassActive,
  updateInsuranceClass,
} from '../api/insurance-classes-api'
import {
  createInsurance,
  deleteInsurance,
  getInsurance,
  listInsurances,
  setInsuranceActive,
  updateInsurance,
} from '../api/insurances-api'
import type { Insurance, InsuranceFormValues } from '../schemas/insurance'
import type { InsuranceClass, InsuranceClassFormValues } from '../schemas/insurance-class'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const insuranceClassKeys = {
  all: ['insurance-classes'] as const,
  list: () => [...insuranceClassKeys.all, 'list'] as const,
  detail: (id: number) => [...insuranceClassKeys.all, 'detail', id] as const,
}
export const insuranceKeys = {
  all: ['insurances'] as const,
  list: () => [...insuranceKeys.all, 'list'] as const,
  detail: (id: number) => [...insuranceKeys.all, 'detail', id] as const,
}

export function useInsuranceClasses() {
  return useQuery({
    queryKey: insuranceClassKeys.list(),
    queryFn: ({ signal }) => listInsuranceClasses(signal),
  })
}

/** One class as it is now, for the edit form; `null` asks for nothing (a new one). */
export function useInsuranceClass(id: number | null) {
  return useQuery({
    queryKey: insuranceClassKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getInsuranceClass(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
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

/**
 * The row's Active switch, once confirmed. When the server has saved it, the
 * new status is written into the cached list at once — the switch shows it as
 * the dialog closes — and the list is read again in the background.
 */
export function useSetInsuranceClassActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setInsuranceClassActive(id, isActive),
    onSuccess: (_message, { id, isActive }) => {
      queryClient.setQueryData<InsuranceClass[]>(insuranceClassKeys.list(), (classes) =>
        classes?.map((item) => (item.id === id ? { ...item, isActive } : item)),
      )
      void queryClient.invalidateQueries({ queryKey: insuranceClassKeys.all })
    },
  })
}

export function useDeleteInsuranceClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteInsuranceClass(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: insuranceClassKeys.all }),
  })
}

export function useInsurances() {
  return useQuery({
    queryKey: insuranceKeys.list(),
    queryFn: ({ signal }) => listInsurances(signal),
  })
}

/** One insurance in full, for the edit form; `null` asks for nothing (a new one). */
export function useInsurance(id: number | null) {
  return useQuery({
    queryKey: insuranceKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getInsurance(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

/**
 * Creating or saving an insurance can send a portal password, so neither goes
 * through `useMutation`: TanStack Query would keep the variables — the
 * password — in its mutation cache and show them in devtools (the same rule
 * as sign-in, docs/SECURITY.md §2). The caller tracks the pending state with
 * its form; these only send, refresh the lists, and resolve with the server's
 * message.
 */
export function useCreateInsurance(): (values: InsuranceFormValues) => Promise<string | null> {
  const queryClient = useQueryClient()
  return async (values) => {
    const message = await createInsurance(values)
    void queryClient.invalidateQueries({ queryKey: insuranceKeys.all })
    // A class or bucket counts its insurances.
    void queryClient.invalidateQueries({ queryKey: insuranceClassKeys.all })
    return message
  }
}

export function useUpdateInsurance(): (id: number, values: InsuranceFormValues) => Promise<string | null> {
  const queryClient = useQueryClient()
  return async (id, values) => {
    const message = await updateInsurance(id, values)
    void queryClient.invalidateQueries({ queryKey: insuranceKeys.all })
    void queryClient.invalidateQueries({ queryKey: insuranceClassKeys.all })
    return message
  }
}

/**
 * The row's Active switch, once confirmed. When the server has saved it, the
 * new status is written into the cached list at once — the switch shows it as
 * the dialog closes — and the list is read again in the background.
 */
export function useSetInsuranceActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setInsuranceActive(id, isActive),
    onSuccess: (_message, { id, isActive }) => {
      queryClient.setQueryData<Insurance[]>(insuranceKeys.list(), (insurances) =>
        insurances?.map((insurance) => (insurance.id === id ? { ...insurance, isActive } : insurance)),
      )
      void queryClient.invalidateQueries({ queryKey: insuranceKeys.all })
    },
  })
}

export function useDeleteInsurance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteInsurance(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: insuranceKeys.all })
      void queryClient.invalidateQueries({ queryKey: insuranceClassKeys.all })
    },
  })
}

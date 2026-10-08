import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProcedureCode,
  deleteProcedureCode,
  getProcedureCode,
  listProcedureCodes,
  setProcedureCodeActive,
  setProcedureCodeDefaultFee,
  updateProcedureCode,
} from '../api/procedure-codes-api'
import type { ProcedureCode } from '../schemas/procedure-code'
import type { ProcedureCodeFormValues } from '../schemas/procedure-code-form'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const procedureCodeKeys = {
  all: ['procedure-codes'] as const,
  list: () => [...procedureCodeKeys.all, 'list'] as const,
  detail: (id: number) => [...procedureCodeKeys.all, 'detail', id] as const,
}

export function useProcedureCodes() {
  return useQuery({
    queryKey: procedureCodeKeys.list(),
    queryFn: ({ signal }) => listProcedureCodes(signal),
  })
}

/** One code as it is now, for the edit form; `null` asks for nothing (a new one). */
export function useProcedureCode(id: number | null) {
  return useQuery({
    queryKey: procedureCodeKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getProcedureCode(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

function useInvalidateProcedureCodes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: procedureCodeKeys.all })
}

export function useCreateProcedureCode() {
  const invalidate = useInvalidateProcedureCodes()
  return useMutation({
    mutationFn: (values: ProcedureCodeFormValues) => createProcedureCode(values),
    onSuccess: invalidate,
  })
}

export function useUpdateProcedureCode() {
  const invalidate = useInvalidateProcedureCodes()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ProcedureCodeFormValues }) =>
      updateProcedureCode(id, values),
    onSuccess: invalidate,
  })
}

/** Exceptions: a code charged at $0.00 gets a default fee — the fee alone. */
export function useSetProcedureCodeDefaultFee() {
  const invalidate = useInvalidateProcedureCodes()
  return useMutation({
    mutationFn: ({ id, defaultFee }: { id: number; defaultFee: number }) =>
      setProcedureCodeDefaultFee(id, defaultFee),
    onSuccess: invalidate,
  })
}

/**
 * The row's Active switch, once confirmed. When the server has saved it, the
 * new status is written into the cached list at once — the switch shows it as
 * the dialog closes — and the list is read again in the background.
 */
export function useSetProcedureCodeActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setProcedureCodeActive(id, isActive),
    onSuccess: (_message, { id, isActive }) => {
      queryClient.setQueryData<ProcedureCode[]>(procedureCodeKeys.list(), (codes) =>
        codes?.map((code) => (code.id === id ? { ...code, isActive } : code)),
      )
      void queryClient.invalidateQueries({ queryKey: procedureCodeKeys.all })
    },
  })
}

export function useDeleteProcedureCode() {
  const invalidate = useInvalidateProcedureCodes()
  return useMutation({
    mutationFn: (id: number) => deleteProcedureCode(id),
    onSuccess: invalidate,
  })
}

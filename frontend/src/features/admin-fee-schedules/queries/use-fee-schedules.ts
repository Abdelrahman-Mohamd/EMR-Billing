import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFeeRow, deleteFeeRow, getFeeRow, listFeeRows, updateFeeRow } from '../api/fee-schedules-api'
import type { FeeRowFormValues } from '../schemas/fee-row-form'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const feeScheduleKeys = {
  all: ['fee-schedules'] as const,
  list: () => [...feeScheduleKeys.all, 'list'] as const,
  detail: (id: number) => [...feeScheduleKeys.all, 'detail', id] as const,
}

export function useFeeSchedules() {
  return useQuery({
    queryKey: feeScheduleKeys.list(),
    queryFn: ({ signal }) => listFeeRows(signal),
    // Read again whenever a screen opens it: a row carries its code's text,
    // description and default fee, which Procedure codes can change — and
    // deleting a code deletes its rows.
    staleTime: 0,
  })
}

/** One row as it is now, for the edit form; `null` asks for nothing (a new one). */
export function useFeeRow(id: number | null) {
  return useQuery({
    queryKey: feeScheduleKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getFeeRow(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

function useInvalidateFeeSchedules() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: feeScheduleKeys.all })
}

export function useCreateFeeRow() {
  const invalidate = useInvalidateFeeSchedules()
  return useMutation({
    mutationFn: ({ insuranceId, values }: { insuranceId: number; values: FeeRowFormValues }) =>
      createFeeRow(insuranceId, values),
    onSuccess: invalidate,
  })
}

export function useUpdateFeeRow() {
  const invalidate = useInvalidateFeeSchedules()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: FeeRowFormValues }) => updateFeeRow(id, values),
    onSuccess: invalidate,
  })
}

export function useDeleteFeeRow() {
  const invalidate = useInvalidateFeeSchedules()
  return useMutation({
    mutationFn: (id: number) => deleteFeeRow(id),
    onSuccess: invalidate,
  })
}

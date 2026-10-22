import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteBillingException,
  getExceptionGroups,
  listBillingExceptions,
  reprocessBillingException,
  scanPractice,
  type ExceptionFilter,
} from '../api/billing-exceptions-api'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const billingExceptionKeys = {
  all: ['billing-exceptions'] as const,
  list: (filter: ExceptionFilter) => [...billingExceptionKeys.all, 'list', filter] as const,
  groups: (filter: ExceptionFilter) => [...billingExceptionKeys.all, 'groups', filter] as const,
}

/**
 * The exceptions the filter asks for. Read again on each visit to the screen:
 * any save elsewhere — a patient, a case, a visit — can add or clear some.
 */
export function useBillingExceptions(filter: ExceptionFilter) {
  return useQuery({
    queryKey: billingExceptionKeys.list(filter),
    queryFn: ({ signal }) => listBillingExceptions(filter, signal),
    staleTime: 0,
  })
}

/** The queue's counts by type and reason. */
export function useExceptionGroups(filter: ExceptionFilter) {
  return useQuery({
    queryKey: billingExceptionKeys.groups(filter),
    queryFn: ({ signal }) => getExceptionGroups(filter, signal),
    staleTime: 0,
  })
}

function useInvalidateExceptions() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: billingExceptionKeys.all })
}

export function useScanPractice() {
  const invalidate = useInvalidateExceptions()
  return useMutation({ mutationFn: (practiceId: number) => scanPractice(practiceId), onSuccess: invalidate })
}

/** A re-check refreshes the list whatever it answers: a 404 means the exception is already gone. */
export function useReprocessException() {
  const invalidate = useInvalidateExceptions()
  return useMutation({ mutationFn: (id: number) => reprocessBillingException(id), onSettled: invalidate })
}

export function useDeleteException() {
  const invalidate = useInvalidateExceptions()
  return useMutation({ mutationFn: (id: number) => deleteBillingException(id), onSuccess: invalidate })
}

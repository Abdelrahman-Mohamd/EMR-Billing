import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCaseInsurance,
  deleteCaseInsurance,
  listCaseInsurances,
  setCaseInsuranceSubscriber,
  updateCaseInsurance,
} from '../api/case-insurances-api'
import type {
  CaseInsurancePayload,
  CaseInsuranceUpdatePayload,
  SubscriberPayload,
} from '../schemas/case-insurance'
import { authorizationKeys } from './use-authorizations'
import { patientCaseKeys } from './use-patient-cases'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const caseInsuranceKeys = {
  all: ['case-insurances'] as const,
  list: () => [...caseInsuranceKeys.all, 'list'] as const,
}

export function useCaseInsurances() {
  return useQuery({
    queryKey: caseInsuranceKeys.list(),
    queryFn: ({ signal }) => listCaseInsurances(signal),
  })
}

/**
 * After a coverage changes: the coverages, the cases (a case's record names its
 * insurances) and the authorizations (a deleted coverage takes its own with it,
 * and they show its name).
 */
function useInvalidateCoverages() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: caseInsuranceKeys.all }),
      queryClient.invalidateQueries({ queryKey: patientCaseKeys.all }),
      queryClient.invalidateQueries({ queryKey: authorizationKeys.all }),
    ])
}

export function useCreateCaseInsurance() {
  const invalidate = useInvalidateCoverages()
  return useMutation({
    mutationFn: (payload: CaseInsurancePayload) => createCaseInsurance(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateCaseInsurance() {
  const invalidate = useInvalidateCoverages()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CaseInsuranceUpdatePayload }) =>
      updateCaseInsurance(id, payload),
    onSuccess: invalidate,
  })
}

/** Exceptions: a coverage's missing subscriber details — the subscriber alone. */
export function useSetCaseInsuranceSubscriber() {
  const invalidate = useInvalidateCoverages()
  return useMutation({
    mutationFn: ({ id, subscriber }: { id: string; subscriber: SubscriberPayload | null }) =>
      setCaseInsuranceSubscriber(id, subscriber),
    onSuccess: invalidate,
  })
}

export function useDeleteCaseInsurance() {
  const invalidate = useInvalidateCoverages()
  return useMutation({
    mutationFn: (id: string) => deleteCaseInsurance(id),
    onSuccess: invalidate,
  })
}

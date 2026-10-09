import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPatientCase,
  deletePatientCase,
  listPatientCases,
  setCaseDiagnoses,
  updatePatientCase,
  updatePatientCaseFields,
} from '../api/patient-cases-api'
import type {
  PatientCaseFieldsPayload,
  PatientCasePayload,
  PatientCaseUpdatePayload,
} from '../schemas/patient-case'
import { authorizationKeys } from './use-authorizations'
import { patientKeys } from './use-patients'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const patientCaseKeys = {
  all: ['patient-cases'] as const,
  list: () => [...patientCaseKeys.all, 'list'] as const,
}

export function usePatientCases() {
  return useQuery({
    queryKey: patientCaseKeys.list(),
    queryFn: ({ signal }) => listPatientCases(signal),
  })
}

/** After a case changes: the cases, and the patients (a patient's record names their cases). */
function useInvalidateCases() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: patientCaseKeys.all }),
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
    ])
}

export function useCreatePatientCase() {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: (payload: PatientCasePayload) => createPatientCase(payload),
    // Waits for the list: the server returns no id, so the new case is found in it.
    onSuccess: invalidate,
  })
}

export function useUpdatePatientCase() {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PatientCaseUpdatePayload }) =>
      updatePatientCase(id, payload),
    onSuccess: invalidate,
  })
}

/** Exceptions: a case's injury date or referring physician fixed — those fields alone. */
export function useUpdatePatientCaseFields() {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: PatientCaseFieldsPayload }) =>
      updatePatientCaseFields(id, fields),
    onSuccess: invalidate,
  })
}

/** Adds, moves or removes a diagnosis: the whole list, in pointer order. */
export function useSetCaseDiagnoses() {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: ({ id, codes }: { id: string; codes: readonly string[] }) => setCaseDiagnoses(id, codes),
    onSuccess: invalidate,
  })
}

export function useDeletePatientCase() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: (id: string) => deletePatientCase(id),
    // The server deletes the case's authorizations with it.
    onSuccess: () =>
      Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: authorizationKeys.all })]),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  setPatientActive,
  updatePatient,
  updatePatientFields,
} from '../api/patients-api'
import { authorizationKeys } from './use-authorizations'
import type { Patient, PatientSummary } from '../model/patient'
import type { PatientFieldsPayload } from '../schemas/patient'
import type { PatientFormValues } from '../schemas/patient-form'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const patientKeys = {
  all: ['patients'] as const,
  list: () => [...patientKeys.all, 'list'] as const,
  detail: (id: string) => [...patientKeys.all, 'detail', id] as const,
}

export function usePatients() {
  return useQuery({
    queryKey: patientKeys.list(),
    queryFn: ({ signal }) => listPatients(signal),
  })
}

/** One patient's whole record, as it is now: the chart reads it on every visit. */
export function usePatient(id: string) {
  return useQuery({
    queryKey: patientKeys.detail(id),
    queryFn: ({ signal }) => getPatient(id, signal),
    staleTime: 0,
  })
}

function useInvalidatePatients() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: patientKeys.all })
}

/**
 * Create and save, as plain functions rather than mutations: the values can
 * hold an SSN, which must not sit in the mutation cache.
 */
export function usePatientWrites() {
  const invalidate = useInvalidatePatients()
  return {
    create: async (values: PatientFormValues) => {
      const message = await createPatient(values)
      void invalidate()
      return message
    },
    update: async (id: string, values: PatientFormValues) => {
      const message = await updatePatient(id, values)
      void invalidate()
      return message
    },
  }
}

/** Exceptions: a patient's phone, address or name lengths fixed — those fields alone. */
export function useUpdatePatientFields() {
  const invalidate = useInvalidatePatients()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: PatientFieldsPayload }) =>
      updatePatientFields(id, fields),
    onSuccess: invalidate,
  })
}

/**
 * Deactivate or reactivate, once confirmed. When the server has saved it, the
 * new status is written into the cached list at once and the patient is read
 * again in the background.
 */
export function useSetPatientActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setPatientActive(id, isActive),
    onSuccess: (_message, { id, isActive }) => {
      queryClient.setQueryData<PatientSummary[]>(patientKeys.list(), (patients) =>
        patients?.map((patient) => (patient.id === id ? { ...patient, isActive } : patient)),
      )
      // The chart's header, too.
      queryClient.setQueryData<Patient>(patientKeys.detail(id), (patient) =>
        patient === undefined ? undefined : { ...patient, isActive },
      )
      void queryClient.invalidateQueries({ queryKey: patientKeys.all })
    },
  })
}

export function useDeletePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: (_message, id) => {
      // The chart that showed them is gone; do not read them again.
      queryClient.removeQueries({ queryKey: patientKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: patientKeys.list() })
      // The server deletes their cases' authorizations with them.
      void queryClient.invalidateQueries({ queryKey: authorizationKeys.all })
    },
  })
}

import { usePractices } from '@/features/admin-practices'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { providerName, useProviders } from '@/features/admin-providers'
import { fullName, listName, usePatientRecords } from '@/features/patients'
import { formatIsoDate } from '@/lib/utils/dates'
import type { RecordRef } from '../schemas/visit'

const same = (a: RecordRef | null, b: RecordRef) => a !== null && String(a) === String(b)

/**
 * Turns a visit's references into what a person reads: the patient and case
 * behind `case_id`, the location, the providers, the authorization, the
 * procedure code and the diagnoses a pointer names. Never a raw id on screen.
 * Reads the features that own those records (Patients, Practices & locations,
 * Providers, Procedure codes).
 */
export function useVisitReferences() {
  const records = usePatientRecords()
  const practices = usePractices()
  const providers = useProviders()
  const codes = useProcedureCodes()

  const locations = (practices.data ?? []).flatMap((practice) => practice.locations)

  const caseOf = (caseId: RecordRef) => records.cases.find((item) => same(item.id, caseId))
  const patientOf = (caseId: RecordRef) => {
    const item = caseOf(caseId)
    return item === undefined ? undefined : records.patients.find((patient) => patient.id === item.patientId)
  }

  return {
    /** False until the lists the names come from have arrived. */
    ready: records.ready && codes.ready && !practices.isPending && !providers.isPending,
    caseOf,
    patientOf,
    /** "Okonkwo, Nadia". */
    patientListName: (caseId: RecordRef) => {
      const patient = patientOf(caseId)
      return patient === undefined ? 'Patient' : listName(patient)
    },
    /** "Nadia Okonkwo". */
    patientFullName: (caseId: RecordRef) => {
      const patient = patientOf(caseId)
      return patient === undefined ? 'Patient' : fullName(patient)
    },
    caseName: (caseId: RecordRef) => caseOf(caseId)?.name ?? 'Case',
    locationName: (id: number) => locations.find((location) => location.id === id)?.name ?? '—',
    providerName: (id: number) => {
      const provider = providers.data?.find((item) => item.id === id)
      return provider === undefined ? '—' : providerName(provider)
    },
    authorizationLabel: (id: RecordRef | null) => {
      if (id === null) return ''
      const auth = records.authorizations.find((item) => same(item.id, id))
      return auth === undefined
        ? '—'
        : `${auth.number} · ${formatIsoDate(auth.start)} – ${formatIsoDate(auth.end)}`
    },
    /** "97110" and "Therapeutic exercise". */
    procedure: (code: RecordRef) => {
      const found = codes.codes.find((item) => item.code === String(code))
      return { code: String(code), description: found?.description ?? '' }
    },
    /** The case's diagnosis at a pointer (1 = the first), e.g. "M54.50". */
    diagnosisAt: (caseId: RecordRef, pointer: number) => caseOf(caseId)?.diagnoses[pointer - 1]?.code ?? '',
    // Pickers for a new visit or line.
    records,
    practices: practices.data ?? [],
    providers: providers.data ?? [],
    codes: codes.codes,
  }
}

export type VisitReferences = ReturnType<typeof useVisitReferences>

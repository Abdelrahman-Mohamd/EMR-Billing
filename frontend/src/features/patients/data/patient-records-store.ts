import type { Authorization } from '../model/authorization'
import type { PatientCase } from '../model/case'
import type { Coverage } from '../model/coverage'
import type { PatientSummary } from '../model/patient'
import { useAuthorizations } from '../queries/use-authorizations'
import { useCaseInsurances } from '../queries/use-case-insurances'
import { usePatientCases } from '../queries/use-patient-cases'
import { usePatients } from '../queries/use-patients'

/**
 * The patients' records in one place. The patients, their cases (with their
 * diagnoses), the cases' insurances and the authorizations those issued all
 * come from the server (`queries/`); `usePatientRecords()` hands them out
 * together, each authorization with the case of the insurance that issued it,
 * so the screens that read them keep one source. Nothing is kept in this tab.
 * Nothing here enforces who may see or change a patient: the server decides
 * that on every request (docs/SECURITY.md §1). No record is ever logged.
 */
export interface PatientRecordsSource {
  /** False until the server's patients, cases and coverages have arrived. */
  ready: boolean
  /** Every patient, as the server lists them. */
  patients: readonly PatientSummary[]
  /** Every case, as the server holds it, with its diagnoses. */
  cases: readonly PatientCase[]
  /** Every case's insurances, as the server holds them. */
  coverages: readonly Coverage[]
  /** Every authorization, as the server holds it, with its insurance's case. */
  authorizations: readonly Authorization[]
}

export function usePatientRecords(): PatientRecordsSource {
  const patients = usePatients()
  const cases = usePatientCases()
  const coverages = useCaseInsurances()
  const authorizations = useAuthorizations()
  // An authorization's case is its insurance's; one whose insurance is not
  // listed (yet) has none to show under.
  const caseOf = new Map((coverages.data ?? []).map((coverage) => [coverage.id, coverage.caseId]))
  return {
    ready: patients.isSuccess && cases.isSuccess && coverages.isSuccess,
    patients: patients.data ?? [],
    cases: cases.data ?? [],
    coverages: coverages.data ?? [],
    authorizations: (authorizations.data ?? []).flatMap((auth) => {
      const caseId = caseOf.get(auth.coverageId)
      return caseId === undefined ? [] : [{ ...auth, caseId }]
    }),
  }
}

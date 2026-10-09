import { useSyncExternalStore } from 'react'
import type { Authorization } from '../model/authorization'
import type { PatientCase } from '../model/case'
import type { Coverage } from '../model/coverage'
import type { PatientSummary } from '../model/patient'
import { useAuthorizations } from '../queries/use-authorizations'
import { useCaseInsurances } from '../queries/use-case-insurances'
import { usePatientCases } from '../queries/use-patient-cases'
import { usePatients } from '../queries/use-patients'

/**
 * The patients' records in one place. The patients, their cases, the cases'
 * insurances and the authorizations those issued come from the server
 * (`queries/`); `usePatientRecords()` hands them out together, each
 * authorization with the case of the insurance that issued it, so the screens
 * that read them keep one source.
 *
 * WHAT IS STILL KEPT IN THIS TAB — **there is no backend for it yet**: the
 * ICD-10 codes a diagnosis is picked from, and so what a case's codes read
 * as. It lasts until the page reloads and starts empty — no sample data.
 * Nothing here enforces who may see or change a patient: the server decides
 * that on every request (docs/SECURITY.md §1). No record is ever logged.
 */
export interface Icd10Code {
  code: string
  description: string
}

interface Snapshot {
  /** The ICD-10 codes a diagnosis is picked from. */
  icd10: readonly Icd10Code[]
}

const EMPTY: Snapshot = { icd10: [] }

let snapshot: Snapshot = EMPTY
const listeners = new Set<() => void>()

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export interface PatientRecordsSource extends Snapshot {
  /** False until the server's patients, cases and coverages have arrived. */
  ready: boolean
  /** Every patient, as the server lists them. */
  patients: readonly PatientSummary[]
  /** Every case, as the server holds it, with its codes' descriptions. */
  cases: readonly PatientCase[]
  /** Every case's insurances, as the server holds them. */
  coverages: readonly Coverage[]
  /** Every authorization, as the server holds it, with its insurance's case. */
  authorizations: readonly Authorization[]
}

export function usePatientRecords(): PatientRecordsSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  const patients = usePatients()
  const serverCases = usePatientCases()
  const coverages = useCaseInsurances()
  const authorizations = useAuthorizations()
  const describe = (code: string) => current.icd10.find((item) => item.code === code)?.description ?? ''
  const cases: PatientCase[] = (serverCases.data ?? []).map(({ icd10Codes, ...item }) => ({
    ...item,
    diagnoses: icd10Codes.map((code) => ({ code, description: describe(code) })),
  }))
  // An authorization's case is its insurance's; one whose insurance is not
  // listed (yet) has none to show under.
  const caseOf = new Map((coverages.data ?? []).map((coverage) => [coverage.id, coverage.caseId]))
  return {
    ...current,
    ready: patients.isSuccess && serverCases.isSuccess && coverages.isSuccess,
    patients: patients.data ?? [],
    cases,
    coverages: coverages.data ?? [],
    authorizations: (authorizations.data ?? []).flatMap((auth) => {
      const caseId = caseOf.get(auth.coverageId)
      return caseId === undefined ? [] : [{ ...auth, caseId }]
    }),
  }
}

/** Tests only: start from known records. */
export function resetPatientRecords(records: Partial<Snapshot>): void {
  publish({ ...EMPTY, ...structuredClone(records) })
}

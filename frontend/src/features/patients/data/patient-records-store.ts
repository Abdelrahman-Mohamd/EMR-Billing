import { useSyncExternalStore } from 'react'
import { todayIso } from '@/lib/utils/dates'
import type { Authorization } from '../model/authorization'
import { DEFAULT_CASE_NAME, MAX_DIAGNOSES, type Diagnosis, type PatientCase } from '../model/case'
import type { Coverage } from '../model/coverage'
import type { Patient } from '../model/patient'

/**
 * WHERE PATIENTS LIVE FOR NOW — a temporary, in-memory store in this browser
 * tab, for patients and what hangs off them: their coverage, cases (with
 * diagnoses) and authorizations. **There is no backend for any of it**, so
 * nothing here calls a server, and nothing pretends to: no endpoint, payload or
 * request. This is architecture only; the screens show no message about it.
 *
 * - Changes last until the page reloads.
 * - In development and tests it starts with the prototype's patients
 *   (`sample-patients.ts`, loaded only when `__MOCK_DATA__` is true, so a
 *   production build never contains them); otherwise it starts empty — and
 *   with no ICD-10 code list, which only a backend can supply.
 * - The screens only use `usePatientRecords()`. When a backend exists, that
 *   hook is replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5)
 *   and this file is deleted — the screens do not change.
 * - One store, not one per kind of record: a patient's removal takes its
 *   cases, coverage and authorizations with it, as the prototype does.
 * - Nothing here enforces who may see or change a patient: the server decides
 *   that on every request (docs/SECURITY.md §1). No record is ever logged.
 *
 * Same pattern as the roles, coding rules and procedure codes stores.
 */
export interface Icd10Code {
  code: string
  description: string
}

interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  patients: readonly Patient[]
  coverages: readonly Coverage[]
  cases: readonly PatientCase[]
  authorizations: readonly Authorization[]
  /** The ICD-10 codes a diagnosis is picked from. */
  icd10: readonly Icd10Code[]
}

const EMPTY: Snapshot = { ready: true, patients: [], coverages: [], cases: [], authorizations: [], icd10: [] }

let snapshot: Snapshot = { ...EMPTY, ready: !__MOCK_DATA__ }
const listeners = new Set<() => void>()
let nextId = 1
const newId = (kind: string) => `${kind}-${nextId++}`

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-patients').then(({ SAMPLE_RECORDS }) => {
    if (snapshot.ready) return
    publish({ ready: true, ...structuredClone(SAMPLE_RECORDS) })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function change(update: (current: Snapshot) => Partial<Snapshot>): void {
  publish({ ...snapshot, ...update(snapshot) })
}

const replace = <T extends { id: string }>(list: readonly T[], id: string, update: (item: T) => T) =>
  list.map((item) => (item.id === id ? update(item) : item))

export type PatientValues = Omit<Patient, 'id' | 'billingId' | 'emrId' | 'isActive'>
export type CoverageValues = Omit<Coverage, 'id' | 'patientId'>
export type CaseValues = Omit<PatientCase, 'id' | 'patientId' | 'diagnoses'>
export type AuthorizationValues = Omit<Authorization, 'id' | 'caseId' | 'used'>

/** Why a coverage could not be removed: the cases that still use it. */
export type RemoveCoverageResult = { removed: true } | { removed: false; usedBy: string[] }

export interface PatientRecordsSource extends Snapshot {
  /** A new patient, active, with a "Default" case, as the prototype creates it. */
  createPatient: (values: PatientValues) => { patientId: string; caseId: string }
  /** Updates the patient. An empty SSN keeps the one on file (it is never shown to be edited). */
  updatePatient: (id: string, values: PatientValues) => void
  setPatientActive: (id: string, isActive: boolean) => void
  /** The patient and their cases, coverage and authorizations. */
  deletePatient: (id: string) => void

  addCoverage: (patientId: string, values: CoverageValues) => void
  updateCoverage: (id: string, values: CoverageValues) => void
  /** Refused while a case uses the coverage, as in the prototype. */
  removeCoverage: (id: string) => RemoveCoverageResult

  createCase: (patientId: string, values: CaseValues) => string
  updateCase: (id: string, values: CaseValues) => void

  addDiagnosis: (caseId: string, diagnosis: Diagnosis) => void
  /** Swaps a diagnosis with its neighbour: -1 up, +1 down. */
  moveDiagnosis: (caseId: string, index: number, direction: -1 | 1) => void
  removeDiagnosis: (caseId: string, index: number) => void

  addAuthorization: (caseId: string, values: AuthorizationValues) => void
  /** Refused once visits have used it, as in the prototype. */
  removeAuthorization: (id: string) => boolean
}

export function usePatientRecords(): PatientRecordsSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ...current,
    createPatient: (values) => {
      const patientId = newId('patient')
      const caseId = newId('case')
      const patient: Patient = { ...values, id: patientId, billingId: null, emrId: null, isActive: true }
      const created: PatientCase = {
        id: caseId,
        patientId,
        name: DEFAULT_CASE_NAME,
        referrerId: null,
        primaryCoverageId: null,
        secondaryCoverageId: null,
        injuryType: '',
        injuryDate: '',
        accidentState: '',
        employmentStatus: '',
        startOfCare: todayIso(),
        dischargeDate: '',
        isActive: true,
        diagnoses: [],
      }
      change((s) => ({ patients: [patient, ...s.patients], cases: [...s.cases, created] }))
      return { patientId, caseId }
    },
    updatePatient: (id, values) =>
      change((s) => ({
        patients: replace(s.patients, id, (patient) => ({
          ...patient,
          ...values,
          ssn: values.ssn === '' ? patient.ssn : values.ssn,
        })),
      })),
    setPatientActive: (id, isActive) =>
      change((s) => ({ patients: replace(s.patients, id, (patient) => ({ ...patient, isActive })) })),
    deletePatient: (id) =>
      change((s) => {
        const caseIds = new Set(s.cases.filter((item) => item.patientId === id).map((item) => item.id))
        return {
          patients: s.patients.filter((patient) => patient.id !== id),
          cases: s.cases.filter((item) => item.patientId !== id),
          coverages: s.coverages.filter((coverage) => coverage.patientId !== id),
          authorizations: s.authorizations.filter((auth) => !caseIds.has(auth.caseId)),
        }
      }),

    addCoverage: (patientId, values) =>
      change((s) => ({ coverages: [...s.coverages, { ...values, id: newId('coverage'), patientId }] })),
    updateCoverage: (id, values) =>
      change((s) => ({ coverages: replace(s.coverages, id, (coverage) => ({ ...coverage, ...values })) })),
    removeCoverage: (id) => {
      const usedBy = snapshot.cases
        .filter((item) => item.primaryCoverageId === id || item.secondaryCoverageId === id)
        .map((item) => item.name)
      if (usedBy.length > 0) return { removed: false, usedBy }
      change((s) => ({ coverages: s.coverages.filter((coverage) => coverage.id !== id) }))
      return { removed: true }
    },

    createCase: (patientId, values) => {
      const id = newId('case')
      change((s) => ({ cases: [...s.cases, { ...values, id, patientId, diagnoses: [] }] }))
      return id
    },
    updateCase: (id, values) =>
      change((s) => ({ cases: replace(s.cases, id, (item) => ({ ...item, ...values })) })),

    addDiagnosis: (caseId, diagnosis) =>
      change((s) => ({
        cases: replace(s.cases, caseId, (item) =>
          item.diagnoses.length >= MAX_DIAGNOSES
            ? item
            : { ...item, diagnoses: [...item.diagnoses, diagnosis] },
        ),
      })),
    moveDiagnosis: (caseId, index, direction) =>
      change((s) => ({
        cases: replace(s.cases, caseId, (item) => {
          const other = index + direction
          if (other < 0 || other >= item.diagnoses.length) return item
          const diagnoses = [...item.diagnoses]
          const [a, b] = [diagnoses[index], diagnoses[other]]
          if (a === undefined || b === undefined) return item
          diagnoses[index] = b
          diagnoses[other] = a
          return { ...item, diagnoses }
        }),
      })),
    removeDiagnosis: (caseId, index) =>
      change((s) => ({
        cases: replace(s.cases, caseId, (item) => ({
          ...item,
          diagnoses: item.diagnoses.filter((_, position) => position !== index),
        })),
      })),

    addAuthorization: (caseId, values) =>
      change((s) => ({
        authorizations: [...s.authorizations, { ...values, id: newId('auth'), caseId, used: 0 }],
      })),
    removeAuthorization: (id) => {
      const auth = snapshot.authorizations.find((item) => item.id === id)
      if (auth === undefined || auth.used > 0) return false
      change((s) => ({ authorizations: s.authorizations.filter((item) => item.id !== id) }))
      return true
    },
  }
}

/** Tests only: start from known records. */
export function resetPatientRecords(records: Partial<Omit<Snapshot, 'ready'>>): void {
  publish({ ...EMPTY, ...structuredClone(records), ready: true })
}

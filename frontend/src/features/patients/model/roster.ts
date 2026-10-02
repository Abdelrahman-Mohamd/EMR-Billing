import type { PatientCase } from './case'
import type { Coverage } from './coverage'
import type { Patient } from './patient'

/** The roster's status filter — the prototype's three choices, Active by default. */
export const STATUS_FILTERS = ['Active', 'Inactive', 'All'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export interface PatientFilters {
  /** An insurance name, as the prototype filters by it; '' for any. */
  insurance: string
  status: StatusFilter
}

export const DEFAULT_FILTERS: PatientFilters = { insurance: '', status: 'Active' }

/** How many filters differ from the default — the count on the Filters button. */
export const activeFilterCount = (filters: PatientFilters) =>
  (filters.insurance !== '' ? 1 : 0) + (filters.status !== DEFAULT_FILTERS.status ? 1 : 0)

/** A patient's cases, in the order they were added. */
export const casesOf = (cases: readonly PatientCase[], patientId: string) =>
  cases.filter((item) => item.patientId === patientId)

/**
 * The case the roster and the chart speak for — the prototype's: the first
 * open case, else the first case.
 */
export const leadCase = (cases: readonly PatientCase[]) => cases.find((item) => item.isActive) ?? cases[0]

/** The insurance id of a case's primary coverage, if it has one. */
export function primaryInsuranceId(
  item: PatientCase | undefined,
  coverages: readonly Coverage[],
): number | undefined {
  if (item === undefined || item.primaryCoverageId === null) return undefined
  return coverages.find((coverage) => coverage.id === item.primaryCoverageId)?.insuranceId
}

/** The prototype's search: first and last name in either order, Billing ID or EMR ID. */
export function matchesSearch(patient: Patient, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  const names =
    `${patient.firstName} ${patient.lastName} ${patient.lastName}, ${patient.firstName}`.toLowerCase()
  return (
    names.includes(q) ||
    (patient.billingId !== null && String(patient.billingId).includes(q)) ||
    (patient.emrId !== null && String(patient.emrId).includes(q))
  )
}

import type { PatientCase } from './case'
import { primaryOf, type Coverage } from './coverage'

/** The roster's status filter — the prototype's three choices, Active by default. */
export const STATUS_FILTERS = ['Active', 'Inactive', 'All'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export interface PatientFilters {
  status: StatusFilter
}

export const DEFAULT_FILTERS: PatientFilters = { status: 'Active' }

/** How many filters differ from the default — the count on the Filters button. */
export const activeFilterCount = (filters: PatientFilters) =>
  filters.status !== DEFAULT_FILTERS.status ? 1 : 0

/** A patient's cases, in the order they were added. */
export const casesOf = (cases: readonly PatientCase[], patientId: string) =>
  cases.filter((item) => item.patientId === patientId)

/**
 * The case the chart speaks for — the prototype's: the first open case, else
 * the first case.
 */
export const leadCase = (cases: readonly PatientCase[]) => cases.find((item) => item.isActive) ?? cases[0]

/** The insurance id of a case's primary coverage, if it has one. */
export function primaryInsuranceId(
  item: PatientCase | undefined,
  coverages: readonly Coverage[],
): number | undefined {
  return item === undefined ? undefined : primaryOf(coverages, item.id)?.insuranceId
}

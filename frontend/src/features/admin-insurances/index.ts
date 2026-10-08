/**
 * Public surface of Setup → Insurances and Setup → Insurance classes — one
 * feature, because each screen reads the other's data (a class lists its
 * insurances; an insurance picks its class). Routes and other features import
 * from here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { InsuranceClassesScreen } from './components/InsuranceClassesScreen'
export { InsurancesScreen } from './components/InsurancesScreen'
// Coding rules, fee schedules, cases and Exceptions pick from a practice's classes or insurances.
export { useInsuranceClasses, useInsurances } from './queries/use-insurances'
export { insuranceLabel, insuranceTypeLabel } from './model/rules'
export type { Insurance } from './schemas/insurance'
export type { InsuranceClass } from './schemas/insurance-class'

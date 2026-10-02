/**
 * Public surface of Setup → Insurances and Setup → Insurance classes — one
 * feature, because each screen reads the other's data (a class lists its
 * insurances; an insurance picks its class). Routes and other features import
 * from here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { InsuranceClassesScreen } from './components/InsuranceClassesScreen'
export { InsurancesScreen } from './components/InsurancesScreen'
// Practice-scoped features (the provider claim hold) pick from the practice's insurances.
// Coding rules apply to a practice's classes or insurances.
export { useInsuranceClasses, useInsurances } from './queries/use-insurances'
export { insuranceLabel } from './model/rules'
export type { Insurance } from './schemas/insurance'
export type { InsuranceClass } from './schemas/insurance-class'

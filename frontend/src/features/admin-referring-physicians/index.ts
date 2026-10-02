/**
 * Public surface of Admin → Referring physicians. Routes and other features
 * import from here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { ReferringPhysiciansScreen } from './components/ReferringPhysiciansScreen'
// A patient's case names its referring physician (Box 17).
export { useReferringPhysicians } from './queries/use-referring-physicians'
export type { ReferringPhysician } from './schemas/referring-physician'
// Exceptions: a dummy referring NPI is corrected on the directory profile.
export { useUpdateReferringPhysician } from './queries/use-referring-physicians'

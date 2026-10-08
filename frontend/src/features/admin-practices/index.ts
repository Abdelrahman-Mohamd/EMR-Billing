/**
 * Public surface of Admin → Practices & locations. Routes and other features
 * import from here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { PracticesScreen } from './components/PracticesScreen'
// Practice-scoped features choose a practice with this and read names from the list.
export { PracticeSelect } from './components/PracticeSelect'
// Summaries to pick or name a practice or a location; one practice in full,
// with its locations.
export { useLocations, usePractice, usePractices } from './queries/use-practices'
export type { Location, LocationSummary, Practice, PracticeSummary } from './schemas/practice'

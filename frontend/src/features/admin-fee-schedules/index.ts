/**
 * Public surface of Setup → Fee schedules. Routes import from here only
 * (docs/FRONTEND_ARCHITECTURE.md §3). Frontend only for now — no backend.
 */
export { FeeSchedulesScreen } from './components/FeeSchedulesScreen'
// Exceptions: a code charged at $0.00 can be priced for its payer.
export { useFeeSchedules } from './data/fee-schedule-store'
export type { FeeRow } from './model/fee-row'

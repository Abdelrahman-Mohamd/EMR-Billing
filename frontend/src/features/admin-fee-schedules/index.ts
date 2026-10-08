/**
 * Public surface of Setup → Fee schedules. Routes import from here only
 * (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { FeeSchedulesScreen } from './components/FeeSchedulesScreen'
// Exceptions: a code charged at $0.00 can be priced for its payer.
export { useCreateFeeRow } from './queries/use-fee-schedules'
export type { FeeRow } from './schemas/fee-row'

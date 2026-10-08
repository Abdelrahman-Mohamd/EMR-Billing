/**
 * Public surface of Setup → Procedure codes. Routes import from here only
 * (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { ProcedureCodesScreen } from './components/ProcedureCodesScreen'
// Fee schedules, coding rules, visits and Exceptions read the shared list;
// Exceptions sets a code's missing default fee.
export { useProcedureCodes, useSetProcedureCodeDefaultFee } from './queries/use-procedure-codes'
export type { ProcedureCode } from './schemas/procedure-code'

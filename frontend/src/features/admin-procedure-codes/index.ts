/**
 * Public surface of Setup → Procedure codes. Routes import from here only
 * (docs/FRONTEND_ARCHITECTURE.md §3). Frontend only for now — no backend.
 */
export { ProcedureCodesScreen } from './components/ProcedureCodesScreen'
// Fee schedules price these codes. Frontend only, like the screen: the codes
// live in this browser tab until a backend exists.
export { useProcedureCodes } from './data/procedure-code-store'
export type { ProcedureCode } from './model/procedure-code'

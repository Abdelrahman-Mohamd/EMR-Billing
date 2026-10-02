/**
 * Public surface of Patients. Routes import from here only
 * (docs/FRONTEND_ARCHITECTURE.md §3). Frontend only for now — no backend.
 */
export { PatientsScreen } from './components/PatientsScreen'
export { PatientChart } from './components/chart/PatientChart'
// Exceptions: billing exceptions are fixed on the patient, case and coverage.
export { usePatientRecords } from './data/patient-records-store'
export { fullName, listName } from './model/patient'
export { PHONE_PATTERN, STATE_PATTERN, ZIP_PATTERN } from './schemas/patient-form'
export type { Patient } from './model/patient'
export type { PatientCase } from './model/case'
export type { Coverage } from './model/coverage'

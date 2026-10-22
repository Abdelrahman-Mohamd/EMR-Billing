/**
 * Public surface of Visits (a visit and its charge lines). Routes and Claims
 * import from here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { VisitsScreen } from './components/VisitsScreen'
export { VisitDetail } from './components/VisitDetail'
export { CaseVisitsAction, CaseVisitsList } from './components/CaseVisits'
// Claims: a claim bills a released visit, and is shown with it.
export { useVisitReferences } from './queries/use-visit-references'
// Exceptions: a visit's treating provider and lines are fixed from there.
export { useVisit } from './queries/use-visits'
export { type Visit } from './schemas/visit'
export { isReleased } from './model/visit-status'

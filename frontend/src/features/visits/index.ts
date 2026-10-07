/**
 * Public surface of Visits (a visit and its charge lines). Routes and Claims
 * import from here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { VisitsScreen } from './components/VisitsScreen'
export { VisitDetail } from './components/VisitDetail'
export { CaseVisitsAction, CaseVisitsList } from './components/CaseVisits'
// Claims: a claim is made from a visit's charge line and shown with its visit.
export { useVisits } from './queries/use-visits'
export { useVisitReferences, type VisitReferences } from './queries/use-visit-references'
export {
  chargeLineFields,
  type ChargeLine,
  type ChargeLineFields,
  type RecordRef,
  type Visit,
} from './schemas/visit'
export { lineCode, modifiersText, pointersText, type LineLike } from './model/charge-line-text'

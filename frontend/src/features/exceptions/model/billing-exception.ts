/**
 * A billing exception as the screens see it: a data problem the server found
 * on a patient, a case or a visit before a claim is built (PRD V2 §4.4) — the
 * server's (schemas/billing-exception.ts).
 */
export interface BillingException {
  id: number
  practiceId: number
  /** `patient`, `case` or `charge` (a visit, or one of its lines). */
  type: string
  /** The type as the list names it: "Patient". */
  level: string
  /** The server's reason code, e.g. `zip_state_mismatch`. */
  reason: string
  /** The reason as the list names it: "ZIP code does not match the state". */
  trigger: string
  /** The server's message: "ZIP code 23423 does not belong to NY." */
  detail: string
  /** The record it sits on: the patient (always), and the case, visit and line when it is theirs. */
  patientId: string | null
  patientFirstName: string
  patientLastName: string
  caseId: string | null
  visitId: number | null
  /** The visit's date of service, ISO; '' when not a visit's. */
  visitDate: string
  chargeLineId: number | null
  /** When it was first found: a timestamp. */
  detectedAt: string
}

/** The server's types, in the order the queue shows them. */
export const EXCEPTION_TYPES = ['patient', 'case', 'charge'] as const

const TYPE_LABELS: Readonly<Record<string, string>> = {
  patient: 'Patient',
  case: 'Case',
  charge: 'Charge',
}

/** Any other type is shown as sent, capitalised, rather than disappearing. */
const asWords = (value: string) => {
  const words = value.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const typeLabel = (type: string): string => TYPE_LABELS[type] ?? asWords(type)

/** The server's reasons (the backend's workflow, 2026-10-19), as the list names them. */
const REASON_LABELS: Readonly<Record<string, string>> = {
  placeholder_phone: 'Placeholder phone number',
  zip_state_mismatch: 'ZIP code does not match the state',
  field_too_long: 'Too long for the claim form',
  no_primary_insurance: 'No primary insurance',
  missing_referring_physician: 'No referring physician',
  invalid_referring_npi: 'Invalid referring physician NPI',
  missing_injury_date: 'No injury date',
  missing_employer: 'Workers’ Comp without an employer',
  incomplete_subscriber: 'Incomplete subscriber',
  missing_rendering_npi: 'No treating provider NPI',
  invalid_rendering_npi: 'Invalid treating provider NPI',
  no_diagnosis: 'No diagnosis codes',
  zero_amount: 'Charged at $0.00',
  no_fee_mapping: 'No fee for the code',
}

export const reasonLabel = (reason: string): string => REASON_LABELS[reason] ?? asWords(reason)

/**
 * Where a reason is fixed: one of the prototype's Resolve forms, on the record
 * the problem is in — or, with no form for it, the page that holds that
 * record (a case's insurance and employer, and a visit's diagnoses, are edited
 * there).
 */
export type Resolution =
  | {
      kind: 'form'
      form:
        | 'patient-phone'
        | 'patient-address'
        | 'patient-length'
        | 'case-injury-date'
        | 'case-referrer'
        | 'referrer-npi'
        | 'subscriber'
        | 'provider-npi'
        | 'fee'
    }
  | { kind: 'open'; place: 'case' | 'visit' | 'patient' }

const FORMS: Readonly<Record<string, Extract<Resolution, { kind: 'form' }>['form']>> = {
  placeholder_phone: 'patient-phone',
  zip_state_mismatch: 'patient-address',
  field_too_long: 'patient-length',
  missing_injury_date: 'case-injury-date',
  missing_referring_physician: 'case-referrer',
  invalid_referring_npi: 'referrer-npi',
  incomplete_subscriber: 'subscriber',
  missing_rendering_npi: 'provider-npi',
  invalid_rendering_npi: 'provider-npi',
  zero_amount: 'fee',
  no_fee_mapping: 'fee',
}

export function resolutionOf(exception: Pick<BillingException, 'reason' | 'caseId' | 'visitId'>): Resolution {
  const form = FORMS[exception.reason]
  if (form !== undefined) return { kind: 'form', form }
  if (exception.visitId !== null) return { kind: 'open', place: 'visit' }
  if (exception.caseId !== null) return { kind: 'open', place: 'case' }
  return { kind: 'open', place: 'patient' }
}

/** "Ahmed, Adam" — as the patients list names a patient. */
export const recordName = (exception: BillingException): string =>
  [exception.patientLastName, exception.patientFirstName].filter(Boolean).join(', ') || 'Patient'

/**
 * A billing exception as the prototype shows it: a data problem caught on an
 * incoming record before a claim is built (PRD V2 §4.4), at one of five
 * levels, with the record it was found on and where it is fixed.
 *
 * **Frontend-only:** no backend exists for exceptions, so this is the screen's
 * own shape, built from the prototype's fields — not a contract, and its names
 * say nothing about what a server will send. Detection is the server's job;
 * nothing in the frontend raises an exception.
 */
export const EXCEPTION_LEVELS = ['Patient', 'Case', 'Session', 'Charge', 'Payment'] as const
export type ExceptionLevel = (typeof EXCEPTION_LEVELS)[number]

export type ExceptionStatus = 'Open' | 'Resolved'

/** What the exception was found on: an EMR session (a visit) or a remittance (ERA). */
export type ExceptionRecord =
  | {
      kind: 'visit'
      /** The patient's id in the patients list. */
      patientId: string
      /** Date of service, ISO. */
      dos: string
      /** The EMR record number of the session. */
      recordId: string
    }
  | {
      kind: 'era'
      /** The remittance's control number. */
      control: string
      payerName: string
    }

/**
 * Where the exception is fixed — the source record the prototype's Resolve
 * form edits. Payment-level fixes need claims and remittances, which do not
 * exist here yet, so they have no form.
 */
export type ExceptionFix =
  | { type: 'patient-phone'; patientId: string }
  | { type: 'patient-address'; patientId: string }
  | { type: 'patient-length'; patientId: string }
  | {
      type: 'case'
      caseId: string
      /** The case field that is missing. */
      field: 'injuryDate' | 'employmentStatus' | 'referrer'
    }
  | { type: 'coverage'; coverageId: string }
  | { type: 'referrer'; referrerId: number; caseId: string }
  | { type: 'provider-npi'; providerId: number }
  | {
      type: 'fee'
      /** The CPT / HCPCS code charged at $0.00. */
      procedureCode: string
      /** The case's primary insurance, when it has one. */
      insuranceId: number | null
    }
  | { type: 'era-claim' }
  | { type: 'carc' }

export interface BillingException {
  id: string
  practiceId: number
  level: ExceptionLevel
  /** What was caught, e.g. "ZIP code mismatch with state". */
  trigger: string
  /** The particulars, e.g. "ZIP 07030 belongs to NJ, but the state is NY." */
  detail: string
  record: ExceptionRecord
  fix: ExceptionFix
  status: ExceptionStatus
  /** ISO date and time. */
  detectedAt: string
  /** Who is working on it, by name; null when unassigned. */
  owner: string | null
  /** ISO date; null when none is set. */
  due: string | null
  /** ISO date and time; null while open. */
  resolvedAt: string | null
  /** Who resolved it, by name; null while open. */
  resolvedBy: string | null
}

/** The prototype resolves every level but Payment from Exceptions. */
export const canResolve = (exception: BillingException): boolean =>
  exception.status === 'Open' && exception.fix.type !== 'era-claim' && exception.fix.type !== 'carc'

/**
 * Two exceptions point at the same fix when they edit the same record in the
 * same way — fixing it settles both (the same patient's phone on two sessions).
 */
export function fixKey(fix: ExceptionFix): string {
  switch (fix.type) {
    case 'patient-phone':
    case 'patient-address':
    case 'patient-length':
      return `${fix.type}:${fix.patientId}`
    case 'case':
      return `case:${fix.caseId}:${fix.field}`
    case 'coverage':
      return `coverage:${fix.coverageId}`
    case 'referrer':
      return `referrer:${fix.referrerId}`
    case 'provider-npi':
      return `provider-npi:${fix.providerId}`
    case 'fee':
      return `fee:${fix.procedureCode}`
    case 'era-claim':
    case 'carc':
      return fix.type
  }
}

/** The record the exception sits on, for "the visit still has…": the session, or the remittance. */
export function recordKey(record: ExceptionRecord): string {
  return record.kind === 'visit' ? `visit:${record.recordId}` : `era:${record.control}`
}

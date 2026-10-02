/**
 * A patient's insurance policy (coverage), as the prototype shows it: one of
 * the practice's insurances, with the member ID, group number and the like.
 * The patient keeps a list; each case chooses its Primary and optional
 * Secondary from it (client 2026-09-30). **Frontend only** — not a contract.
 */
export interface Subscriber {
  name: string
  /** ISO date. */
  dob: string
  relationship: string
}

export interface Employer {
  name: string
  address: string
}

export interface Coverage {
  id: string
  patientId: string
  /** The insurance (Setup → Insurances). */
  insuranceId: number
  memberId: string
  /** "NONE" when the plan has none. */
  groupNumber: string
  /** Box 11b for PIP and Workers' Comp. */
  claimNumber: string
  /** Null: the patient is the subscriber (Self). */
  subscriber: Subscriber | null
  /** Workers' Comp only. */
  employer: Employer | null
}

export const SUBSCRIBER_RELATIONSHIPS = ['Self', 'Spouse', 'Child', 'Other'] as const

/** The insurance types for which the prototype asks for a claim number. */
export const CLAIM_NUMBER_TYPES = ['PIP', 'Workers Comp'] as const
export const WORKERS_COMP = 'Workers Comp'

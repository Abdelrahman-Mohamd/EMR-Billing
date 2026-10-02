/**
 * A case — one episode of care — as the prototype shows it (PRD V2 §3.2,
 * §10.4). Every visit inherits its referring physician, diagnoses, injury type
 * and onset date. **Frontend only** — not a contract.
 */
export interface Diagnosis {
  code: string
  description: string
}

export interface PatientCase {
  id: string
  patientId: string
  name: string
  /** The referring physician (Setup → Referring physicians). */
  referrerId: number | null
  primaryCoverageId: string | null
  secondaryCoverageId: string | null
  /** '' — not related to an injury. */
  injuryType: string
  /** ISO dates, '' when none. */
  injuryDate: string
  accidentState: string
  employmentStatus: string
  startOfCare: string
  dischargeDate: string
  /** Open (true) or closed. */
  isActive: boolean
  /** In claim order: the position is the diagnosis pointer (Box 21 / 24E). */
  diagnoses: Diagnosis[]
}

/** Related cause — "Other" was removed by the client (Q-092). */
export const INJURY_TYPES = ['Employment Related', 'Auto'] as const
export const AUTO = 'Auto'

/** A case holds up to 12 diagnoses — the claim's pointers. */
export const MAX_DIAGNOSES = 12

/** The case a new patient starts with, as in the prototype. */
export const DEFAULT_CASE_NAME = 'Default'

/**
 * A patient as the prototype shows it (PRD V2 §10.4; guarantor address from the
 * meeting of 2026-09-23). **Frontend only:** no backend exists for patients, so
 * this is the screen's own shape, not a contract.
 *
 * Deliberately absent: Billing preferences / `no_statements` (removed by the
 * client, Q-091), emergency contact (CH-14a), guarantor date of birth (Q-069).
 */
export interface PostalAddress {
  line1: string
  line2: string
  city: string
  state: string
  zip: string
}

/** The responsible party when it is not the patient. */
export interface Guarantor {
  name: string
  relationship: string
  address: Omit<PostalAddress, 'line2'>
}

export interface Patient {
  id: string
  practiceId: number
  /** Assigned by the billing system; unknown for a patient added here until a backend assigns it. */
  billingId: number | null
  /** The EMR's id — the sync key. Null for a patient added by hand. */
  emrId: number | null
  firstName: string
  middleName: string
  lastName: string
  /** ISO date. */
  dob: string
  gender: string
  /** Never shown in full here — see `maskSsn`. '' when there is none. */
  ssn: string
  phoneCell: string
  phoneHome: string
  email: string
  address: PostalAddress
  /** Null: the patient receives the statements. */
  guarantor: Guarantor | null
  notes: string
  isActive: boolean
}

export const GENDERS = ['Female', 'Male', 'Other'] as const
export const GUARANTOR_RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Other'] as const

/** "Okonkwo, Nadia" — how the roster lists a patient. */
export const listName = (patient: Pick<Patient, 'firstName' | 'lastName'>) =>
  `${patient.lastName}, ${patient.firstName}`

/** "Nadia Okonkwo". */
export const fullName = (patient: Pick<Patient, 'firstName' | 'lastName'>) =>
  `${patient.firstName} ${patient.lastName}`

/** The prototype's mask: only the last four digits. */
export const maskSsn = (ssn: string) => (ssn === '' ? '' : `***-**-${ssn.slice(-4)}`)

/** Whole years on `today` (both ISO dates). */
export function ageOn(dob: string, today: string): number {
  const [by, bm, bd] = dob.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  if (
    by === undefined ||
    bm === undefined ||
    bd === undefined ||
    ty === undefined ||
    tm === undefined ||
    td === undefined
  )
    return 0
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

/** "8622 5th Avenue, Suite 2, Brooklyn, NY 11209". */
export function addressLine(address: Partial<PostalAddress>): string {
  const street = [address.line1, address.line2].filter(Boolean).join(', ')
  const place = [address.city, [address.state, address.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  return [street, place].filter(Boolean).join(', ')
}

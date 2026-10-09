import type { SelectOption } from '@/components/ui/Select'

/**
 * A patient as the screens see them — read from the server (schemas/patient.ts).
 * The roster's list carries a summary; the chart reads the whole record.
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
  firstName: string
  lastName: string
  relationship: string
  /** ISO date, '' when none. */
  dob: string
  address: Omit<PostalAddress, 'line2'> | null
}

/** What the roster's list carries. */
export interface PatientSummary {
  /** The server's id, as text: the chart's address and the key of the records kept in this tab. */
  id: string
  /** The server's id: the Billing ID. */
  billingId: number
  practiceId: number
  /** The EMR's id — the sync key. Null for a patient added by hand. */
  emrId: number | null
  firstName: string
  middleName: string
  lastName: string
  /** ISO date. */
  dob: string
  /** M, F or U. */
  gender: string
  /** As the server words it: "Male". */
  genderLabel: string
  /** As the server sends it — only ever masked ("***-**-6789"); '' when there is none. */
  maskedSsn: string
  isActive: boolean
}

/** A case as the patient's record names it. */
export interface PatientCaseRef {
  id: string
  name: string
  isActive: boolean
}

/** The whole record, as the chart reads it. */
export interface Patient extends PatientSummary {
  /** Ten digits as stored; see `showPhone`. */
  phoneCell: string
  phoneHome: string
  email: string
  address: PostalAddress
  /** Null: the patient receives the statements. */
  guarantor: Guarantor | null
  notes: string
  /** True: no statements are sent for this patient. */
  noStatements: boolean
  cases: PatientCaseRef[]
}

/** The server's genders, in the prototype's order. */
export const GENDERS: readonly SelectOption[] = [
  { value: 'F', label: 'Female' },
  { value: 'M', label: 'Male' },
  { value: 'U', label: 'Unknown' },
]

export function genderName(patient: Pick<PatientSummary, 'gender' | 'genderLabel'>): string {
  return (
    patient.genderLabel || GENDERS.find((option) => option.value === patient.gender)?.label || patient.gender
  )
}

/** The server's guarantor relationships. */
export const GUARANTOR_RELATIONSHIPS = ['Spouse', 'Parent', 'Legal Guardian', 'Other'] as const

/** "Okonkwo, Nadia" — how the roster lists a patient. */
export const listName = (patient: Pick<PatientSummary, 'firstName' | 'lastName'>) =>
  `${patient.lastName}, ${patient.firstName}`

/** "Nadia Okonkwo". */
export const fullName = (patient: Pick<PatientSummary, 'firstName' | 'lastName'>) =>
  `${patient.firstName} ${patient.lastName}`

/** Ten stored digits, shown as 718-555-0100; anything else as it came. */
export function showPhone(value: string): string {
  return /^\d{10}$/.test(value) ? `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}` : value
}

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

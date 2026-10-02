/**
 * The prototype's checks, as its Resolve forms apply them (PRD V2 §4.4, BR20).
 * They only validate what the user types into a fix; finding exceptions is the
 * server's job.
 */

/** Placeholder phone numbers the prototype flags. */
const DUMMY_PHONES: ReadonlySet<string> = new Set([
  '000-000-0000',
  '111-111-1111',
  '999-999-9999',
  '123-456-7890',
])

export const isDummyPhone = (phone: string): boolean => DUMMY_PHONES.has(phone)

/** The prototype's character limits on a claim: the patient's name and an address line. */
export const LIMITS = { name: 30, addressLine: 35 } as const

/**
 * The prototype's ZIP-prefix table: the first three digits of a ZIP code and
 * the state they belong to. It covers the states the prototype's practices
 * see; a ZIP outside it belongs to no state the check knows, and is not
 * questioned.
 */
const ZIP_STATES: ReadonlyArray<readonly [from: number, to: number, state: string]> = [
  [10, 27, 'MA'],
  [28, 29, 'RI'],
  [30, 38, 'NH'],
  [60, 69, 'CT'],
  [70, 89, 'NJ'],
  [100, 149, 'NY'],
  [150, 196, 'PA'],
  [197, 199, 'DE'],
  [200, 205, 'DC'],
  [206, 219, 'MD'],
]

/** The state a ZIP code belongs to, as far as the table knows; null otherwise. */
export function zipState(zip: string): string | null {
  const prefix = Number.parseInt(zip.slice(0, 3), 10)
  if (Number.isNaN(prefix)) return null
  return ZIP_STATES.find(([from, to]) => prefix >= from && prefix <= to)?.[2] ?? null
}

export interface LengthValues {
  firstName: string
  middleName: string
  lastName: string
  line1: string
}

/**
 * The prototype's "Fill in a truncated version": the first given name only,
 * no middle name, the last name cut so the whole name fits, and the address
 * line cut to its limit. The user reviews the result before saving.
 */
export function truncated(values: LengthValues): LengthValues {
  const firstName = values.firstName.trim().split(/\s+/)[0] ?? ''
  const room = LIMITS.name - firstName.length - 1
  const lastName =
    `${firstName} ${values.lastName}`.length > LIMITS.name ? values.lastName.slice(0, room) : values.lastName
  return { firstName, middleName: '', lastName, line1: values.line1.slice(0, LIMITS.addressLine) }
}

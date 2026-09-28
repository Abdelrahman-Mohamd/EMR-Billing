/**
 * NPIs that are placeholders, not real numbers. PRD V2 §4.4 (BR20) flags dummy
 * NPIs such as 9999999999 and 1234567890; this is the prototype's list of them.
 */
const DUMMY_NPIS: ReadonlySet<string> = new Set(['9999999999', '1234567890', '0000000000', '1111111111'])

export function isDummyNpi(npi: string): boolean {
  return DUMMY_NPIS.has(npi)
}

/** Ten digits and not a placeholder — what the list marks as invalid otherwise. */
export function isValidNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi) && !isDummyNpi(npi)
}

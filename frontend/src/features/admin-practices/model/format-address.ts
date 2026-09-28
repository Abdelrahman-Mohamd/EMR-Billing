import type { Address } from '../schemas/practice'

/** One line, as the prototype prints it: "line1, line2, city, state zip". */
export function formatAddress(address: Address): string {
  const street =
    address.line2 === undefined || address.line2 === '' ? address.line1 : `${address.line1}, ${address.line2}`
  return `${street}, ${address.city}, ${address.state} ${address.zip}`
}

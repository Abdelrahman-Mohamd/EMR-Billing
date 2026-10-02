import { formatIsoDate } from '@/lib/utils/dates'

/**
 * A provider's claim hold, as the prototype shows it (client, 2026-09-23): a
 * window from an optional start date to an end date, a reason, and the
 * locations and payers it covers — none named means all of them.
 *
 * Only what the list displays is computed here: whether the hold is running
 * today, and how its window and scope read. What a running hold does to
 * visits and claims is the backend's; nothing here applies it.
 */
export interface ClaimHold {
  /** ISO date or null. */
  from: string | null
  /** ISO date; null means there is no hold. */
  until: string | null
  reason: string
  locationIds: readonly number[]
  insuranceIds: readonly number[]
}

/** The prototype's rule: running from its start (if any) through its end date, inclusive. */
export function holdRunning(hold: ClaimHold, today: string): boolean {
  return hold.until !== null && today <= hold.until && (hold.from === null || today >= hold.from)
}

/** "09/01/2026 – 09/30/2026", or "until 09/30/2026" without a start. */
export function holdWindow(hold: ClaimHold): string {
  if (hold.until === null) return ''
  return hold.from === null
    ? `until ${formatIsoDate(hold.until)}`
    : `${formatIsoDate(hold.from)} – ${formatIsoDate(hold.until)}`
}

/** "every location and payer", or the names it is limited to. */
export function holdScope(locationNames: readonly string[], insuranceNames: readonly string[]): string {
  if (locationNames.length === 0 && insuranceNames.length === 0) return 'every location and payer'
  return [
    locationNames.length > 0 ? locationNames.join(', ') : 'every location',
    insuranceNames.length > 0 ? insuranceNames.join(', ') : 'every payer',
  ].join(' · ')
}

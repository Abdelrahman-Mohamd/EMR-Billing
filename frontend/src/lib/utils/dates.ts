/**
 * Plain ISO dates ("2026-09-30") as the product shows them. No time zones are
 * involved: an ISO date is a calendar day, read in the viewer's own calendar.
 */

/** Today as an ISO date, in the viewer's own calendar. */
export function todayIso(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "2026-09-30" → "09/30/2026" — the app's date format. */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return year !== undefined && month !== undefined && day !== undefined ? `${month}/${day}/${year}` : iso
}

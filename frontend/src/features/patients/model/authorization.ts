import type { Tone } from '@/components/ui/Badge'

/**
 * A payer's pre-approval for a number of visits or units within a date range,
 * issued by one of the case's insurances — as the server holds it
 * (schemas/authorization.ts). `used` and `remaining` are the server's: visits
 * use an authorization, nothing here does. The case is the issuing insurance's.
 */
export interface Authorization {
  id: string
  /** The case of the insurance that issued it. */
  caseId: string
  /** The case insurance that issued it. */
  coverageId: string
  /** The issuing insurance as the server names it: "1039 – Corvel Enterprise". */
  insuranceName: string
  number: string
  /** ISO dates. */
  start: string
  end: string
  qty: number
  unit: AuthUnit
  used: number
  remaining: number
}

export type AuthUnit = 'visits' | 'units'

/** The server's units, with the words the screens show. */
export const AUTH_UNITS: ReadonlyArray<{ value: AuthUnit; label: string }> = [
  { value: 'visits', label: 'Visits' },
  { value: 'units', label: 'Units' },
]

/** The prototype's status of an authorization on `today` (ISO date). */
export function authStatus(auth: Authorization, today: string): { label: string; tone: Tone } {
  if (today < auth.start) return { label: 'Not started', tone: 'info' }
  if (today > auth.end) return { label: 'Expired', tone: 'inert' }
  if (auth.remaining === 0) return { label: 'Exhausted', tone: 'critical' }
  if (auth.remaining <= 1)
    return { label: auth.unit === 'units' ? 'Last unit' : 'Last visit', tone: 'warning' }
  return { label: 'Active', tone: 'success' }
}

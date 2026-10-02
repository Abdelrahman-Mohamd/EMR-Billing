import type { Tone } from '@/components/ui/Badge'

/**
 * A payer's pre-approval for a number of visits or units within a date range,
 * issued by the case's primary or secondary insurance — as the prototype shows
 * it. **Frontend only** — not a contract. `used` is counted by visits, which
 * the server records; nothing here consumes an authorization.
 */
export interface Authorization {
  id: string
  caseId: string
  /** The coverage that issued it. */
  coverageId: string
  number: string
  /** ISO dates. */
  start: string
  end: string
  qty: number
  unit: string
  used: number
}

export const AUTH_UNITS = ['Visits', 'Units'] as const

export const authRemaining = (auth: Pick<Authorization, 'qty' | 'used'>) => Math.max(0, auth.qty - auth.used)

/** The prototype's status of an authorization on `today` (ISO date). */
export function authStatus(auth: Authorization, today: string): { label: string; tone: Tone } {
  if (today < auth.start) return { label: 'Not started', tone: 'info' }
  if (today > auth.end) return { label: 'Expired', tone: 'inert' }
  const remaining = authRemaining(auth)
  if (remaining === 0) return { label: 'Exhausted', tone: 'critical' }
  if (remaining <= 1) return { label: 'Last visit', tone: 'warning' }
  return { label: 'Active', tone: 'success' }
}

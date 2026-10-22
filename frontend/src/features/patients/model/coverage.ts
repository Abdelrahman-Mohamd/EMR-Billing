import type { SelectOption } from '@/components/ui/Select'

/**
 * A case's insurance (a coverage): one of the practice's insurances on one
 * case, with its rank — Primary, Secondary or Tertiary — and the member ID,
 * group number and the like. It is the server's (`/case-insurances`); claims
 * are addressed to it. (The prototype kept a list per patient and had each
 * case choose from it; the server keeps it per case — user, 2026-10-08.)
 */
export interface Subscriber {
  firstName: string
  lastName: string
  relationship: string
  /** ISO date, '' when none. */
  dob: string
  /** M, F or U, '' when none. */
  gender: string
}

export interface Employer {
  name: string
  address: { line1: string; city: string; state: string; zip: string } | null
}

export interface Coverage {
  /** The server's id, as text. */
  id: string
  caseId: string
  /** The insurance (Setup → Insurances). */
  insuranceId: number
  /** "1039 – Corvel Enterprise", as the server names it. */
  insuranceLabel: string
  insuranceName: string
  /** The insurance's type code: WC, AM… */
  insuranceType: string
  /** 1 Primary, 2 Secondary, 3 Tertiary. */
  rank: number
  rankLabel: string
  memberId: string
  groupNumber: string
  /** Box 11b for Workers' Comp (required there) and PIP. */
  claimNumber: string
  /** Null: the patient is the subscriber (Self). */
  subscriber: Subscriber | null
  employer: Employer | null
  /** ISO dates, '' when none. */
  effectiveDate: string
  terminationDate: string
}

/** The server's ranks. */
export const RANKS: readonly SelectOption[] = [
  { value: '1', label: 'Primary' },
  { value: '2', label: 'Secondary' },
  { value: '3', label: 'Tertiary' },
]

export const rankName = (coverage: Pick<Coverage, 'rank' | 'rankLabel'>): string =>
  coverage.rankLabel ||
  RANKS.find((rank) => rank.value === String(coverage.rank))?.label ||
  `Rank ${coverage.rank}`

/** Self — no subscriber — then the server's relationships. */
export const SUBSCRIBER_RELATIONSHIPS = ['Self', 'Spouse', 'Child', 'Other'] as const

/**
 * The insurance types that carry a claim number (Box 11b): Auto / PIP (`AM`)
 * and Workers' Comp (`WC`). The server requires it for Workers' Comp.
 */
export const CLAIM_NUMBER_TYPES = ['AM', 'WC'] as const
export const WORKERS_COMP = 'WC'

/** A case's insurances, in the server's order (each shows its priority). */
export const coveragesOf = (coverages: readonly Coverage[], caseId: string) =>
  coverages.filter((coverage) => coverage.caseId === caseId)

/** A case's primary insurance, if it has one. */
export const primaryOf = (coverages: readonly Coverage[], caseId: string) =>
  coverages.find((coverage) => coverage.caseId === caseId && coverage.rank === 1)

/** "Mary Doe". */
export const subscriberName = (subscriber: Subscriber) =>
  `${subscriber.firstName} ${subscriber.lastName}`.trim()

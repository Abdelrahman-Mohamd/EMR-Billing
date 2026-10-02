import type { Tone } from '@/components/ui/Badge'

/**
 * A location's EMR integration and the payloads the EMR sends, as the
 * prototype shows them (PRD V2 §2). **Frontend only:** no backend exists for
 * EMR integration, so these are the screen's own shapes, not a contract.
 *
 * The prototype's flow, per location:
 * 1. **Request** — someone asks for the location to be linked, giving the
 *    Unique Location ID it shares with its EMR twin. Link: Requested.
 * 2. **Link** — an approver maps it 1:1. Link: Linked. It stays EMR-only.
 * 3. **Elect** — a linked location is switched to Integrated (its sessions
 *    flow into billing) or back to EMR-only (new payloads are blocked).
 */
export type LinkStatus = 'Not linked' | 'Requested' | 'Linked'
export type BillingElection = 'Integrated' | 'EMR only'

export interface LocationIntegration {
  /** The location, from the practices list. */
  locationId: number
  /** Shared with the EMR; '' until requested. */
  uniqueLocationId: string
  link: LinkStatus
  election: BillingElection
  /** Who asked, and when (ISO date) — while Requested. */
  requestedBy: string | null
  requestedOn: string | null
  /** The requester's optional note for the approver. */
  note: string
  /** When it was linked (ISO date). */
  linkedOn: string | null
}

/** Where every location starts, as in the prototype. */
export function notLinked(locationId: number): LocationIntegration {
  return {
    locationId,
    uniqueLocationId: '',
    link: 'Not linked',
    election: 'EMR only',
    requestedBy: null,
    requestedOn: null,
    note: '',
    linkedOn: null,
  }
}

export const LINK_TONE: Record<LinkStatus, Tone> = {
  Linked: 'success',
  Requested: 'warning',
  'Not linked': 'inert',
}

export const ELECTION_TONE: Record<BillingElection, Tone> = {
  Integrated: 'brand',
  'EMR only': 'inert',
}

/** What reconciliation did with a payload — the prototype's four results, in its order. */
export const PAYLOAD_RESULTS = ['Accepted', 'Replaced', 'Updated queue', 'Blocked'] as const
export type PayloadResult = (typeof PAYLOAD_RESULTS)[number]

export const RESULT_TONE: Record<PayloadResult, Tone> = {
  Accepted: 'success',
  Replaced: 'info',
  'Updated queue': 'attention',
  Blocked: 'critical',
}

/** One payload received from the EMR. Holds PHI (the patient): never in a URL or a log. */
export interface Payload {
  id: string
  /** When it was received — a timestamp. */
  at: string
  locationId: number
  /** The EMR's record id for the note. */
  recordId: string
  patient: string
  result: PayloadResult
  detail: string
}

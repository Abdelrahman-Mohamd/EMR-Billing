import { z } from 'zod'
import type { Tone } from '@/components/ui/Badge'

/**
 * A claim, as the backend sends and takes it (contract given 2026-10-09,
 * tried on staging with a made-up patient):
 *
 * - `GET /claims?page=N` → Laravel pagination of `{ id, visit_id,
 *   case_insurance_id, referring_physician_id, format, status, scrub_errors,
 *   allowed_status_changes, total_amount, sent_date, clearinghouse_ref,
 *   insurance: { id, display_name, rank, rank_label, member_id }, patient: {
 *   id, first_name, last_name }, date_of_service, charge_lines: null }`;
 *   `GET /claims/{id}` → the same with the visit's `charge_lines` and the
 *   `referring_physician` — not used: the visit page shows the lines;
 * - `POST /claims` — the contract's example is `{ visit_id, procedure_code_id,
 *   units, modifiers, diagnosis_pointers }`, but the server bills **the whole
 *   visit to one of its case's insurances**: only `visit_id` is required, the
 *   line's fields are ignored (the claim's total is the visit's), and
 *   `case_insurance_id` chooses the insurance (the primary when left out). So
 *   only those two are sent. Answers `{ success, message, data: claim }`;
 * - `PUT /claims/{id}` — `status` (to one of `allowed_status_changes`),
 *   `format` (`837P` or `CMS1500`; fixed once sent), `clearinghouse_ref`; the
 *   visit and the insurance are refused; the referring physician and sent date
 *   are the server's own. `DELETE`. Writes answer `{ success, message, data:
 *   null }`.
 *
 * Seen on staging: only a released visit can be billed ("Only a released
 * visit can be billed. Release it from Charge Review first."); a visit has one
 * claim per insurance ("This visit already has a claim for that insurance.");
 * the secondary only once the primary's claim is paid or denied ("Bill the
 * primary insurance first; …"). A new claim is scrubbed at once ("Claim
 * created and scrubbed"): `scrubbed`, or `held` (e.g. the insurance is on
 * hold). Status runs held → scrubbed → sent (the server stamps `sent_date`) →
 * paid, denied or rejected; never back. A claim that was sent cannot be
 * deleted.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

/** A scrub error as words, whatever shape the server gives it. */
const scrubError = z.unknown().transform((value): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string')
    return value.message
  return JSON.stringify(value)
})

export const claimResponseSchema = z
  .object({
    id: z.number().int(),
    visit_id: z.number().int(),
    case_insurance_id: z.number().int(),
    format: text,
    status: z.string(),
    scrub_errors: z.array(scrubError).nullable().optional(),
    allowed_status_changes: z.array(z.string()).nullable().optional(),
    total_amount: text,
    sent_date: text,
    clearinghouse_ref: text,
    insurance: z.object({ display_name: text, rank_label: text, member_id: text }).nullable().optional(),
    patient: z.object({ id: z.number().int(), first_name: text, last_name: text }).nullable().optional(),
    date_of_service: text,
  })
  .transform((wire) => ({
    id: wire.id,
    visitId: wire.visit_id,
    coverageId: String(wire.case_insurance_id),
    /** `837P` or `CMS1500`. */
    format: wire.format,
    status: wire.status,
    scrubErrors: wire.scrub_errors ?? [],
    /** Where the status may go next, as the server says. */
    allowedStatusChanges: wire.allowed_status_changes ?? [],
    /** "90.00". */
    totalAmount: wire.total_amount,
    /** ISO date, or '' until sent. */
    sentDate: wire.sent_date,
    clearinghouseRef: wire.clearinghouse_ref,
    insuranceName: wire.insurance?.display_name ?? '',
    rankLabel: wire.insurance?.rank_label ?? '',
    memberId: wire.insurance?.member_id ?? '',
    patientId: wire.patient === null || wire.patient === undefined ? '' : String(wire.patient.id),
    patientFirstName: wire.patient?.first_name ?? '',
    patientLastName: wire.patient?.last_name ?? '',
    dateOfService: wire.date_of_service,
  }))

export type Claim = z.output<typeof claimResponseSchema>

export const claimPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(claimResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ claims: data.data, pageCount: data.meta.last_page }))

/** Billing a visit (`POST`): the visit, and the case insurance billed. */
export interface CreateClaimPayload {
  visit_id: number
  case_insurance_id: number
}

/** Saving a claim (`PUT`): only what changed. */
export interface UpdateClaimPayload {
  status?: string
  format?: string
  clearinghouse_ref?: string | null
}

export const CLAIM_FORMATS = [
  { value: '837P', label: '837P (electronic)' },
  { value: 'CMS1500', label: 'CMS-1500 (paper)' },
] as const

export const formatName = (format: string) =>
  CLAIM_FORMATS.find((item) => item.value === format)?.label ?? format

const STATUS: Readonly<Record<string, { label: string; tone: Tone }>> = {
  held: { label: 'Held', tone: 'attention' },
  scrubbed: { label: 'Scrubbed', tone: 'info' },
  sent: { label: 'Sent', tone: 'brand' },
  paid: { label: 'Paid', tone: 'success' },
  denied: { label: 'Denied', tone: 'critical' },
  rejected: { label: 'Rejected', tone: 'critical' },
}

/** The server's status in words — or the server's own word. */
export function claimStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: status.charAt(0).toUpperCase() + status.slice(1), tone: 'inert' }
}

/** A claim not yet sent can still be deleted: the server refuses one that was. */
export const canDelete = (claim: Pick<Claim, 'status'>) =>
  claim.status === 'held' || claim.status === 'scrubbed'

const FIELDS: Readonly<Record<string, string>> = {
  case_insurance_id: 'coverageId',
  clearinghouse_ref: 'clearinghouseRef',
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const claimFormFieldFor = (path: string): string => FIELDS[path] ?? path

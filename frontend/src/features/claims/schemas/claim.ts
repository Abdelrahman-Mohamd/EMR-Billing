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
 * - `POST /claims` `{ visit_id, case_insurance_id, format }` — the server bills
 *   **the whole visit to one of its case's insurances** (re-checked on staging
 *   2026-10-20): `visit_id` is required, `case_insurance_id` chooses the
 *   insurance (the primary when left out), `format` is `837P` (when left out)
 *   or `CMS1500`. The contract's line fields (`procedure_code_id`, `units`,
 *   `modifiers`, `diagnosis_pointers`) are not the server's — the claim's lines
 *   and total are the visit's — so nothing here offers or sends them. Answers
 *   `{ success, message, data: claim }`;
 * - `PUT /claims/{id}` — `status` (to one of `allowed_status_changes`),
 *   `format` (`837P` or `CMS1500`; fixed once sent), `clearinghouse_ref` (at
 *   most 50 characters); the
 *   visit and the insurance are refused; the referring physician and sent date
 *   are the server's own. `DELETE`. Writes answer `{ success, message, data:
 *   null }`.
 *
 * Since 2026-10-22 a claim also carries the server's own references —
 * `patient_control_number` (e.g. "C6", Box 26), `payer_claim_number`,
 * `clearinghouse_batch_id` and `clearinghouse_status` (a save ignores them) —
 * and can be scrubbed again until it is sent: `POST /claims/{id}/scrub` →
 * `{ message: "Claim scrubbed", data: claim }` ("A sent claim cannot be scrubbed
 * again."). A scrub that finds errors leaves the claim `failed`, its
 * `scrub_errors` saying why (e.g. "The practice billing address needs a
 * 9-digit ZIP+4 for an electronic claim (2010AA-N403).").
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
    patient_control_number: text,
    payer_claim_number: text,
    clearinghouse_batch_id: z.union([z.string(), z.number()]).nullable().optional(),
    clearinghouse_status: text,
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
    /** The server's claim number for the patient's account (Box 26): "C6". */
    controlNumber: wire.patient_control_number,
    /** The payer's own number for the claim, once it has one; else ''. */
    payerClaimNumber: wire.payer_claim_number,
    /** The clearinghouse's batch and status, once sent through one; else ''. */
    clearinghouseBatchId:
      wire.clearinghouse_batch_id === null || wire.clearinghouse_batch_id === undefined
        ? ''
        : String(wire.clearinghouse_batch_id),
    clearinghouseStatus: wire.clearinghouse_status,
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
  /** `837P` or `CMS1500`. */
  format: string
}

/** The server's limit on the clearinghouse's reference. */
export const CLEARINGHOUSE_REF_MAX = 50

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
  failed: { label: 'Failed scrub', tone: 'critical' },
  sent: { label: 'Sent', tone: 'brand' },
  paid: { label: 'Paid', tone: 'success' },
  denied: { label: 'Denied', tone: 'critical' },
  rejected: { label: 'Rejected', tone: 'critical' },
}

/** The server's status in words — or the server's own word. */
export function claimStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: status.charAt(0).toUpperCase() + status.slice(1), tone: 'inert' }
}

const UNSENT: ReadonlySet<string> = new Set(['held', 'scrubbed', 'failed'])

/** A claim not yet sent can still be deleted: the server refuses one that was. */
export const canDelete = (claim: Pick<Claim, 'status'>) => UNSENT.has(claim.status)

/** …and scrubbed again (after its data is fixed): a sent one cannot. */
export const canScrub = canDelete

export const claimDetailResponseSchema = z
  .object({ message: z.string().nullable().optional(), data: claimResponseSchema })
  .transform(({ message, data }) => ({ message: message ?? null, claim: data }))

const FIELDS: Readonly<Record<string, string>> = {
  case_insurance_id: 'coverageId',
  clearinghouse_ref: 'clearinghouseRef',
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const claimFormFieldFor = (path: string): string => FIELDS[path] ?? path

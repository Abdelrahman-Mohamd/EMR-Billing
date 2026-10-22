import { z } from 'zod'
import { reasonLabel, typeLabel, type BillingException } from '../model/billing-exception'

/**
 * Billing exceptions, as the backend sends and takes them (contract given
 * 2026-10-19; workflow from the backend, tried on staging 2026-10-20):
 *
 * - `GET /billing-exceptions?page=N` → Laravel pagination of `{ id,
 *   practice_id, type, reason, message, patient_id, case_id, visit_id,
 *   charge_line_id, patient: { id, first_name, last_name }, visit: { id,
 *   date_of_service }, created_at, updated_at }`, newest first. It filters by
 *   `practice_id`, `type` (`patient`, `case` or `charge`; another is refused),
 *   `reason`, `patient_id` and `visit_id`, and takes `per_page` (at most 100);
 *   `search` is ignored. `GET /billing-exceptions/{id}` → one, the same.
 * - `GET /billing-exceptions/grouped` → `{ total, types: [{ type, total,
 *   reasons: [{ reason, message, total }] }] }` — the queue by type, then
 *   reason, with counts (`message` is one example); the same filters.
 * - `POST /billing-exceptions/scan` `{ practice_id }` (required) re-checks
 *   every patient and case of the practice and every visit in review → `{
 *   patients, cases, visits, exceptions }`, the counts checked and found.
 * - `POST /billing-exceptions/{id}/reprocess` re-checks that exception's
 *   record now → the exception, when the problem is still there ("The problem
 *   is still there; fix the data and reprocess again"), else `null` ("Fixed:
 *   the exception is cleared"). An exception already gone is a 404.
 * - `DELETE /billing-exceptions/{id}` → "Billing exception removed". It comes
 *   back when its record is saved, or a visit released, and the problem is
 *   still there.
 *
 * The server finds them: saving a patient, case, case insurance, visit or
 * charge line checks that record, adding a row per problem and deleting the
 * rows whose problem is gone — so the list is always what is wrong now; there
 * is no "resolved". Releasing a visit re-checks all it depends on and pends it
 * while any remain. Saves elsewhere (a provider, a referring physician, a fee
 * schedule, a payer's rules) check nothing: a reprocess or a scan does.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

const id = z.number().int().nullable().optional()

export const billingExceptionResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    // Strings, not enums: a type or reason the frontend does not know yet must
    // not make the whole list fail to load. Known ones: model/billing-exception.ts.
    type: z.string(),
    reason: z.string(),
    message: text,
    patient_id: id,
    case_id: id,
    visit_id: id,
    charge_line_id: id,
    patient: z.object({ first_name: text, last_name: text }).nullable().optional(),
    visit: z.object({ date_of_service: text }).nullable().optional(),
    created_at: text,
  })
  .transform((wire): BillingException => ({
    id: wire.id,
    practiceId: wire.practice_id,
    type: wire.type,
    level: typeLabel(wire.type),
    reason: wire.reason,
    trigger: reasonLabel(wire.reason),
    detail: wire.message,
    patientId: wire.patient_id == null ? null : String(wire.patient_id),
    patientFirstName: wire.patient?.first_name ?? '',
    patientLastName: wire.patient?.last_name ?? '',
    caseId: wire.case_id == null ? null : String(wire.case_id),
    visitId: wire.visit_id ?? null,
    visitDate: wire.visit?.date_of_service ?? '',
    chargeLineId: wire.charge_line_id ?? null,
    detectedAt: wire.created_at,
  }))

export const billingExceptionPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(billingExceptionResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ exceptions: data.data, pageCount: data.meta.last_page }))

export const groupedResponseSchema = z
  .object({
    data: z.object({
      total: z.number().int(),
      types: z.array(
        z.object({
          type: z.string(),
          total: z.number().int(),
          reasons: z.array(z.object({ reason: z.string(), total: z.number().int() })),
        }),
      ),
    }),
  })
  .transform(({ data }) => data)

export type ExceptionGroups = z.output<typeof groupedResponseSchema>

export const scanResponseSchema = z
  .object({
    message: z.string().nullable().optional(),
    data: z.object({
      patients: z.number().int(),
      cases: z.number().int(),
      visits: z.number().int(),
      exceptions: z.number().int(),
    }),
  })
  .transform(({ message, data }) => ({ message: message ?? null, counts: data }))

export type ScanResult = z.output<typeof scanResponseSchema>

/** The re-check's answer: its message, and whether the problem is still there. */
export const reprocessResponseSchema = z
  .object({
    message: z.string().nullable().optional(),
    data: z.object({ id: z.number().int() }).nullable().optional(),
  })
  .transform(({ message, data }) => ({ message: message ?? null, stillThere: data != null }))

export type ReprocessResult = z.output<typeof reprocessResponseSchema>

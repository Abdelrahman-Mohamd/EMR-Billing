import { z } from 'zod'

/**
 * A fee-schedule row, as the backend sends and takes it (contracts confirmed
 * 2026-10-08, tried on staging):
 *
 * - `GET /fee-schedules?page=N` → Laravel pagination of `{ id, insurance_id,
 *   procedure_code_id, billed_amount, effective_from, effective_to, insurance:
 *   { id, code, name }, procedure_code: { id, code, description, default_fee },
 *   created_at, updated_at }`; `GET /fee-schedules/{id}` → the same;
 * - `POST /fee-schedules` `{ insurance_id, procedure_code_id, billed_amount,
 *   effective_from, effective_to }`; `PUT /fee-schedules/{id}` — the same
 *   without the insurance and the code (both refused: a row never moves);
 *   `DELETE`. Writes answer `{ success, message, data: null }`.
 *
 * Seen on staging: required are the insurance, the code (each must exist and
 * be active), the billed amount (0 or more, at most two decimals) and the
 * start date; the end date is optional — `null` is a price with no end — and
 * not before the start. An insurance may price a code more than once, for
 * date ranges that do not overlap; an overlap is refused with a message and
 * no field errors. Amounts come back as strings ("30.00"). A `PUT` changes
 * only the fields it carries. Deleting a procedure code deletes its rows.
 */
const money = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((value) => Number(value ?? 0) || 0)

export const feeRowResponseSchema = z
  .object({
    id: z.number().int(),
    insurance_id: z.number().int(),
    procedure_code_id: z.number().int(),
    billed_amount: money,
    effective_from: z.string(),
    effective_to: z.string().nullable().optional(),
    procedure_code: z
      .object({
        code: z.string(),
        description: z.string().nullable().optional(),
        default_fee: money,
      })
      .nullable()
      .optional(),
  })
  .transform((wire) => ({
    id: wire.id,
    insuranceId: wire.insurance_id,
    procedureCodeId: wire.procedure_code_id,
    /** The code's CPT / HCPCS and description, as the row comes with them. */
    procedureCode: wire.procedure_code?.code ?? '',
    description: wire.procedure_code?.description ?? '',
    /** The code's default fee, for comparison. */
    defaultFee: wire.procedure_code?.default_fee ?? 0,
    /** Billed price per unit, in dollars. */
    billed: wire.billed_amount,
    /** ISO dates, inclusive; no end date is `null`. */
    from: wire.effective_from,
    to: wire.effective_to ?? null,
  }))

export type FeeRow = z.output<typeof feeRowResponseSchema>

export const feeRowPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(feeRowResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ rows: data.data, pageCount: data.meta.last_page }))

export const feeRowDetailResponseSchema = z
  .object({ data: feeRowResponseSchema })
  .transform((wire) => wire.data)

/** Saving a row (`PUT`): its price and dates. */
export interface FeeRowUpdatePayload {
  billed_amount: number
  effective_from: string
  effective_to: string | null
}

/** Creating a row (`POST`): with the insurance and the code it prices. */
export interface FeeRowPayload extends FeeRowUpdatePayload {
  insurance_id: number
  procedure_code_id: number
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const FEE_ROW_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  procedure_code_id: 'procedureCodeId',
  billed_amount: 'billed',
  effective_from: 'from',
  effective_to: 'to',
}

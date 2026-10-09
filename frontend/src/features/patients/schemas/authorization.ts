import { z } from 'zod'
import type { Authorization, AuthUnit } from '../model/authorization'

/**
 * An authorization, as the backend sends and takes it (contract given
 * 2026-10-09, tried on staging with a made-up patient):
 *
 * - `GET /authorizations?page=N` → Laravel pagination of `{ id,
 *   case_insurance_id, number, start_date, end_date, authorized_qty,
 *   used_qty, remaining_qty, unit, is_usable_today, insurance: { id,
 *   display_name, rank }, created_at, updated_at }`; `GET /authorizations/{id}`
 *   → the same;
 * - `POST /authorizations` `{ case_insurance_id, number, start_date, end_date,
 *   authorized_qty, unit }`; `PUT /authorizations/{id}` — without the case
 *   insurance (refused); `DELETE`. Writes answer `{ success, message, data:
 *   null }`.
 *
 * Seen on staging: required are the case insurance, the number (at most 50
 * characters, once per case insurance — "This authorization number is already
 * on this insurance."; case-sensitive), the start and end dates (the end on or
 * after the start; on a `PUT` that breaks the order, a message with no field)
 * and the quantity (a whole number from 1 to 9999). The unit is `visits` or
 * `units`, `visits` when left out. `used_qty` is the server's own, kept from
 * visits — never sent. A `PUT` changes only the fields it carries. Deleting a
 * case insurance deletes the authorizations it issued.
 *
 * Not used here: `is_usable_today` (the status reads the dates and what is
 * left, as the prototype's), `insurance.rank`.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

/** An authorization as the server holds it: its case is its insurance's (`usePatientRecords`). */
export type ServerAuthorization = Omit<Authorization, 'caseId'>

export const authorizationResponseSchema = z
  .object({
    id: z.number().int(),
    case_insurance_id: z.number().int(),
    number: text,
    start_date: text,
    end_date: text,
    authorized_qty: z.number().int(),
    used_qty: z.number().int(),
    remaining_qty: z.number().int(),
    unit: z.enum(['visits', 'units']),
    insurance: z.object({ display_name: text }).nullable().optional(),
  })
  .transform((wire): ServerAuthorization => ({
    id: String(wire.id),
    coverageId: String(wire.case_insurance_id),
    insuranceName: wire.insurance?.display_name ?? '',
    number: wire.number,
    start: wire.start_date,
    end: wire.end_date,
    qty: wire.authorized_qty,
    unit: wire.unit,
    used: wire.used_qty,
    remaining: wire.remaining_qty,
  }))

export const authorizationPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(authorizationResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ authorizations: data.data, pageCount: data.meta.last_page }))

/** Saving an authorization (`PUT`): everything but the insurance that issued it. */
export interface AuthorizationUpdatePayload {
  number: string
  start_date: string
  end_date: string
  authorized_qty: number
  unit: AuthUnit
}

/** Adding an authorization (`POST`): with the case insurance that issued it. */
export interface AuthorizationPayload extends AuthorizationUpdatePayload {
  case_insurance_id: number
}

const FIELDS: Readonly<Record<string, string>> = {
  case_insurance_id: 'coverageId',
  start_date: 'start',
  end_date: 'end',
  authorized_qty: 'qty',
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const authorizationFormFieldFor = (path: string): string => FIELDS[path] ?? path

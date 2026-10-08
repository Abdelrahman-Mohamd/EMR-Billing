import { z } from 'zod'

/**
 * A procedure code, as the backend sends and takes it (contracts confirmed
 * 2026-10-08, tried on staging):
 *
 * - `GET /procedure-codes?page=N` → Laravel pagination of `{ id, code,
 *   description, is_timed, modifier_override, modifiers, default_fee,
 *   procedure_type, procedure_type_label, is_active, created_at, updated_at }`;
 *   `GET /procedure-codes/{id}` → the same;
 * - `POST /procedure-codes` `{ code, description, modifier_override,
 *   modifiers, default_fee, procedure_type }`; `PUT /procedure-codes/{id}`;
 *   `DELETE`. Writes answer `{ success, message, data: null }`.
 *
 * Seen on staging: required are the code, description and procedure type. The
 * code is a CPT (97110, 0001F) or HCPCS (E0114) code, unique, stored in
 * capitals; the type is `evaluation`, `therapeutic`, `modality`, `supply_dme`
 * or `other`; `default_fee` is 0 or more with at most two decimals, 0.00 when
 * left out, never `null` — it comes back as a string ("25.00"). Up to four
 * modifiers of two letters or digits, at least one while the override is on;
 * the server keeps them when the override is off, so the form sends none
 * then. `is_timed` and `is_active` are taken on both writes. Codes belong to
 * no practice. A `PUT` changes only the fields it carries.
 *
 * The prototype's "New from EMR" mark is not in the contract, so it is not
 * here.
 */
export const procedureCodeResponseSchema = z
  .object({
    id: z.number().int(),
    code: z.string(),
    description: z.string(),
    is_timed: z.boolean(),
    modifier_override: z.boolean(),
    modifiers: z.array(z.string()).nullable().optional(),
    // "25.00"; a number is read as well.
    default_fee: z.union([z.string(), z.number()]).nullable().optional(),
    // A string, not an enum: a value the frontend does not know yet must not
    // make the whole list fail to load. Known values: model/procedure-code.ts.
    procedure_type: z.string(),
    procedure_type_label: z.string().nullable().optional(),
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    /** The CPT / HCPCS code, in capitals. */
    code: wire.code,
    description: wire.description,
    procedureType: wire.procedure_type,
    /** The type as the server words it: "Supply / DME". */
    procedureTypeLabel: wire.procedure_type_label ?? '',
    /** Units follow the 8-minute rule. */
    isTimed: wire.is_timed,
    /** Modifier override (client, 2026-09-30): when on, `modifiers` replace a line's own. */
    modifierOverride: wire.modifier_override,
    modifiers: wire.modifiers ?? [],
    /** Default fee per unit, in dollars. */
    defaultFee: Number(wire.default_fee ?? 0) || 0,
    isActive: wire.is_active,
  }))

export type ProcedureCode = z.output<typeof procedureCodeResponseSchema>

export const procedureCodePageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(procedureCodeResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ codes: data.data, pageCount: data.meta.last_page }))

export const procedureCodeDetailResponseSchema = z
  .object({ data: procedureCodeResponseSchema })
  .transform((wire) => wire.data)

/** The request body for create and save. */
export interface ProcedureCodePayload {
  code: string
  description: string
  procedure_type: string
  is_timed: boolean
  modifier_override: boolean
  modifiers: string[]
  default_fee: number
  is_active: boolean
}

/**
 * Backend field → form field, so a server's field error lands on the right
 * input. `modifiers.N` is one modifier's input; `modifiers` (the list as a
 * whole: too many, or none while the override is on) lands on the first.
 */
export function procedureCodeFormFieldFor(path: string): string {
  if (path === 'modifiers') return 'modifiers.0'
  const fields: Readonly<Record<string, string>> = {
    procedure_type: 'procedureType',
    default_fee: 'defaultFee',
    is_timed: 'isTimed',
    is_active: 'isActive',
    modifier_override: 'modifierOverride',
  }
  const [head = '', ...rest] = path.split('.')
  return [fields[head] ?? head, ...rest].join('.')
}

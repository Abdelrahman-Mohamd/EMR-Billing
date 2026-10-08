import { z } from 'zod'
import { isDummyNpi } from '@/lib/validation/npi'

/**
 * A referring physician, as the backend sends and takes it (contracts
 * confirmed 2026-10-08, tried on staging):
 *
 * - `GET /referring-physicians?page=N` → Laravel pagination of `{ id,
 *   practice_id, code, name, type, type_label, npi, phone, fax, is_active,
 *   practice, created_at }`; `GET /referring-physicians/{id}` → the same;
 * - `POST /referring-physicians` `{ practice_id, code, name, type, npi }`;
 *   `PUT /referring-physicians/{id}` — the same without `practice_id`
 *   (refused: a physician never moves practice); `DELETE`. Writes answer
 *   `{ success, message, data: null }`.
 *
 * Seen on staging: `type` is DN (Referring) or DQ (Supervising) — DN when left
 * out, `null` refused; `phone`, `fax` and `is_active` are taken on both writes
 * although not in the example — phone and fax as **exactly ten digits**, no
 * punctuation (the form strips it); the code and the NPI are each unique in the
 * practice; placeholder NPIs are refused; a `PUT` changes only the fields it
 * carries, and `null` clears phone or fax.
 *
 * The prototype's "Practice name" (free text) and Cases count are not in the
 * contract, so they are not here.
 *
 * `code` stays although the client asked on 2026-09-23 to remove it (Q-096):
 * the backend requires it. The conflict is recorded, not resolved here.
 */
export const referringPhysicianResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    code: z.string(),
    name: z.string(),
    // A string, not an enum: a value the frontend does not know yet must not
    // make the whole list fail to load. Known values: model/physician-type.ts.
    type: z.string(),
    type_label: z.string().nullable().optional(),
    npi: z.string(),
    phone: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? ''),
    fax: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? ''),
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    code: wire.code,
    name: wire.name,
    type: wire.type,
    /** The type as the server words it: "Referring", "Supervising". */
    typeLabel: wire.type_label ?? '',
    npi: wire.npi,
    phone: wire.phone,
    fax: wire.fax,
    isActive: wire.is_active,
  }))

export type ReferringPhysician = z.output<typeof referringPhysicianResponseSchema>

export const referringPhysicianPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(referringPhysicianResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ physicians: data.data, pageCount: data.meta.last_page }))

export const referringPhysicianDetailResponseSchema = z
  .object({ data: referringPhysicianResponseSchema })
  .transform((wire) => wire.data)

/** Saving a physician (`PUT`): every field but `practice_id`. */
export interface ReferringPhysicianUpdatePayload {
  code: string
  name: string
  type: string
  npi: string
  phone: string | null
  fax: string | null
  is_active: boolean
}

/** Creating a physician (`POST`): with the practice they belong to. */
export interface ReferringPhysicianPayload extends ReferringPhysicianUpdatePayload {
  practice_id: number
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const REFERRING_PHYSICIAN_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  is_active: 'isActive',
}

const digits = (value: string) => value.replace(/\D/g, '')

/** Empty, or ten digits once punctuation is set aside — sent as the digits. */
const optionalTenDigits = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || digits(value).length === 10, message)

/**
 * What the form accepts. Required: practice, code, name, type and NPI — as the
 * server requires them (type has DN to start). An NPI is ten digits and not a
 * placeholder (PRD V2 §4.4, BR20; the server refuses them too). Phone and fax
 * are optional, ten digits. Uniqueness of the code and the NPI in the practice
 * is the server's to enforce.
 */
export const referringPhysicianFormSchema = z.object({
  // `: boolean` keeps TypeScript from reading the check as a type guard, so
  // the form's values stay `string | null` before and after validation.
  practiceId: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a practice.'),
  code: z.string().trim().min(1, 'Enter the code.').max(20, 'Use at most 20 characters.'),
  name: z.string().trim().min(1, 'Enter the physician name.'),
  type: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a type.'),
  npi: z
    .string()
    .trim()
    .min(1, 'Enter the NPI.')
    .regex(/^\d{10}$/, 'Please enter a valid NPI.')
    .refine((value) => !isDummyNpi(value), 'Please enter a valid NPI.'),
  phone: optionalTenDigits('Enter a 10-digit phone number.'),
  fax: optionalTenDigits('Enter a 10-digit fax number.'),
  isActive: z.boolean(),
})

export type ReferringPhysicianFormValues = z.infer<typeof referringPhysicianFormSchema>

/** Ten stored digits, shown as 800-555-0199; anything else as it came. */
export function showPhone(value: string): string {
  return /^\d{10}$/.test(value) ? `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}` : value
}

/** A saved physician as the form holds them. */
export function toReferringPhysicianFormValues(physician: ReferringPhysician): ReferringPhysicianFormValues {
  return {
    practiceId: String(physician.practiceId),
    code: physician.code,
    name: physician.name,
    type: physician.type,
    npi: physician.npi,
    phone: showPhone(physician.phone),
    fax: showPhone(physician.fax),
    isActive: physician.isActive,
  }
}

/** A save: every field but the practice, which a physician never changes. */
export function toReferringPhysicianUpdatePayload(
  values: ReferringPhysicianFormValues,
): ReferringPhysicianUpdatePayload {
  // The schema has refused a missing type before this runs.
  return {
    code: values.code,
    name: values.name,
    type: values.type ?? '',
    npi: values.npi,
    // The server takes the ten digits only.
    phone: values.phone === '' ? null : digits(values.phone),
    fax: values.fax === '' ? null : digits(values.fax),
    is_active: values.isActive,
  }
}

/** A new physician: with their practice. */
export function toReferringPhysicianPayload(values: ReferringPhysicianFormValues): ReferringPhysicianPayload {
  // The schema has refused a missing practice before this runs.
  return { practice_id: Number(values.practiceId), ...toReferringPhysicianUpdatePayload(values) }
}

import { z } from 'zod'
import { isDummyNpi } from '../model/npi'

/**
 * A referring physician, as the current backend payload defines it:
 * `{ practice_id, code, name, type, npi }` — nothing more. The prototype's
 * phone, fax and free-text practice name are not in the payload and are not
 * here; neither is a taxonomy code.
 *
 * `code` stays although the client asked on 2026-09-23 to remove it (Q-096):
 * the backend payload, which is newer, carries it, and V2 keys the table by it
 * (unique within a practice). The conflict is recorded, not resolved here.
 *
 * Assumed until the contract says otherwise: a saved physician comes back as
 * its payload plus a numeric `id`.
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
    npi: z.string(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    code: wire.code,
    name: wire.name,
    type: wire.type,
    npi: wire.npi,
  }))

export type ReferringPhysician = z.output<typeof referringPhysicianResponseSchema>

/** The request body for create and update — the known payload, exactly. */
export interface ReferringPhysicianPayload {
  practice_id: number
  code: string
  name: string
  type: string
  npi: string
}

/**
 * What the form accepts. Required: every field, as the payload always carries
 * them and the prototype requires name, type and NPI. Checked beyond presence
 * only where the project already checks: an NPI is ten digits (as for
 * practices and locations) and not one of the dummy NPIs PRD V2 §4.4 flags
 * (BR20), as the prototype's form refuses them. Code uniqueness within a
 * practice is the server's to enforce.
 */
export const referringPhysicianFormSchema = z.object({
  // `: boolean` keeps TypeScript from reading the check as a type guard, so
  // the form's values stay `string | null` before and after validation.
  practiceId: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a practice.'),
  code: z.string().trim().min(1, 'Enter the code.'),
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
})

export type ReferringPhysicianFormValues = z.infer<typeof referringPhysicianFormSchema>

export function toReferringPhysicianPayload(values: ReferringPhysicianFormValues): ReferringPhysicianPayload {
  // The schema has refused a missing practice or type before this runs.
  return {
    practice_id: Number(values.practiceId),
    code: values.code,
    name: values.name,
    type: values.type ?? '',
    npi: values.npi,
  }
}

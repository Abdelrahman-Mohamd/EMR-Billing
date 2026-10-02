import { z } from 'zod'

/**
 * A release bucket — a named manual-release queue (PRD V2 §10.3, CH-03) — as
 * the screens see it, parsed from the wire.
 *
 * **Input payload known** (create and update): `{ practice_id, name,
 * description }` — nothing more. There is no status: the prototype's Active
 * flag and V2's `is_active` are not in the payload, so neither is here.
 *
 * Assumed until the contract says otherwise: a saved bucket comes back as its
 * payload plus a numeric `id`. A missing or null description is read as empty,
 * so one record cannot stop the whole list from loading.
 */
export const releaseBucketResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    name: z.string(),
    description: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? ''),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    name: wire.name,
    description: wire.description,
  }))

export type ReleaseBucket = z.output<typeof releaseBucketResponseSchema>

/** The request body for create and update — the known payload, exactly. */
export interface ReleaseBucketPayload {
  practice_id: number
  name: string
  description: string
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const RELEASE_BUCKET_FORM_FIELD_FOR: Readonly<Record<string, string>> = { practice_id: 'practiceId' }

/**
 * What the form accepts. Required: the practice and the name — the prototype
 * requires a name, and a bucket belongs to a practice. The description is
 * optional, as in the prototype. Nothing else is checked: V2 makes a name
 * unique within its practice, and that is the server's to enforce.
 */
export const releaseBucketFormSchema = z.object({
  // `: boolean` keeps TypeScript from reading the check as a type guard, so
  // the form's values stay `string | null` before and after validation.
  practiceId: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a practice.'),
  name: z.string().trim().min(1, 'Enter the bucket name.'),
  description: z.string().trim(),
})

export type ReleaseBucketFormValues = z.infer<typeof releaseBucketFormSchema>

export function toReleaseBucketPayload(values: ReleaseBucketFormValues): ReleaseBucketPayload {
  // The schema has refused a missing practice before this runs. An empty
  // description is sent as "" — the payload always carries the field.
  return { practice_id: Number(values.practiceId), name: values.name, description: values.description }
}

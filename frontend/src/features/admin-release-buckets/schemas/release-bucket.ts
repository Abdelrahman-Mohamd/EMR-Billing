import { z } from 'zod'

/**
 * A release bucket — a named manual-release queue (PRD V2 §10.3, CH-03) — as
 * the backend sends and takes it (contracts confirmed 2026-10-07, tried on
 * staging):
 *
 * - `GET /release-buckets?page=N` → Laravel pagination (15 a page) of
 *   `{ id, practice_id, name, description, is_active, insurances_count,
 *   created_at }`;
 * - `GET /release-buckets/{id}` → the same plus `insurances` and `practice`
 *   (not read: no insurance has been seen in one, so its shape is unknown);
 * - `POST /release-buckets` `{ practice_id, name, description }`;
 *   `PUT /release-buckets/{id}` — the same without `practice_id` (refused: a
 *   bucket never moves practice); `DELETE /release-buckets/{id}`. Writes
 *   answer `{ success, message, data: null }`.
 *
 * `is_active` is not in the example payload, but the server takes it on both
 * (seen on staging), so the form's Active is sent. A `PUT` changes only the
 * fields it carries. An empty description is stored as none (`null`), which is
 * read as empty.
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
    is_active: z.boolean(),
    /** How many insurances are assigned to the bucket — the list carries it. */
    insurances_count: z.number().int().nonnegative().optional(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    name: wire.name,
    description: wire.description,
    isActive: wire.is_active,
    insurancesCount: wire.insurances_count ?? 0,
  }))

export type ReleaseBucket = z.output<typeof releaseBucketResponseSchema>

export const releaseBucketPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(releaseBucketResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ buckets: data.data, pageCount: data.meta.last_page }))

export const releaseBucketDetailResponseSchema = z
  .object({ data: releaseBucketResponseSchema })
  .transform((wire) => wire.data)

/** Saving a bucket (`PUT`): every field but `practice_id`. */
export interface ReleaseBucketUpdatePayload {
  name: string
  description: string
  is_active: boolean
}

/** Creating a bucket (`POST`): with the practice it belongs to. */
export interface ReleaseBucketPayload extends ReleaseBucketUpdatePayload {
  practice_id: number
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const RELEASE_BUCKET_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  is_active: 'isActive',
}

/**
 * What the form accepts. Required: the practice and the name — the prototype
 * requires a name, and a bucket belongs to a practice. The description is
 * optional, as in the prototype. A name unique within its practice is the
 * server's to enforce ("The name has already been taken.").
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
  isActive: z.boolean(),
})

export type ReleaseBucketFormValues = z.infer<typeof releaseBucketFormSchema>

/** A save: every field but the practice, which a bucket never changes. */
export function toReleaseBucketUpdatePayload(values: ReleaseBucketFormValues): ReleaseBucketUpdatePayload {
  // An empty description is sent as "" — on a save, that clears it.
  return { name: values.name, description: values.description, is_active: values.isActive }
}

/** A new bucket: with its practice. */
export function toReleaseBucketPayload(values: ReleaseBucketFormValues): ReleaseBucketPayload {
  // The schema has refused a missing practice before this runs.
  return { practice_id: Number(values.practiceId), ...toReleaseBucketUpdatePayload(values) }
}

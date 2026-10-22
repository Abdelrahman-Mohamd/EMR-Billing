import { z } from 'zod'

/**
 * A case's diagnosis, as the backend sends and takes it (contract given
 * 2026-10-20, tried on staging with a made-up case):
 *
 * - each case lists its own as `diagnoses: [{ id, case_id, icd10_code,
 *   description, created_at, updated_at }]` (schemas/patient-case.ts) — the
 *   chart reads them there; `GET /case-diagnoses` and `GET /case-diagnoses/{id}`
 *   send the same records;
 * - `POST /case-diagnoses` `{ case_id, icd10_code, description? }`;
 *   `PUT /case-diagnoses/{id}` — without `case_id` (refused); `DELETE`. Writes
 *   answer `{ success, message, data: null }` — no new id.
 *
 * Seen on staging: the code must be a valid ICD-10-CM code ("The diagnosis
 * must be a valid ICD-10-CM code, e.g. M54.2."); the server capitals it. A code
 * is on a case once ("This diagnosis is already on the case.") and a case holds
 * at most 12 ("A case can have at most 12 diagnosis codes." — a message with
 * no field). The description is optional, at most 255 characters. A `PUT`
 * changes only the fields it carries.
 *
 * There is no position: a case lists its diagnoses in the order they were
 * added, and that order is the pointer a new visit copies — so a diagnosis
 * cannot be moved, only deleted and added again.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

export const caseDiagnosisResponseSchema = z
  .object({
    id: z.number().int(),
    icd10_code: z.string(),
    description: text,
  })
  .transform((wire) => ({ id: String(wire.id), code: wire.icd10_code, description: wire.description }))

/** Saving a diagnosis (`PUT`): its code and description. */
export interface CaseDiagnosisUpdatePayload {
  icd10_code: string
  /** None: `null`. */
  description: string | null
}

/** Adding a diagnosis (`POST`): with its case. */
export interface CaseDiagnosisPayload extends CaseDiagnosisUpdatePayload {
  case_id: number
}

export const DESCRIPTION_MAX = 255

/** What the diagnosis form accepts. Whether the code is a real ICD-10-CM code is the server's to say. */
export const caseDiagnosisFormSchema = z.object({
  code: z.string().trim().min(1, 'Enter an ICD-10 code.'),
  description: z.string().trim().max(DESCRIPTION_MAX, `Use at most ${DESCRIPTION_MAX} characters.`),
})
export type CaseDiagnosisFormValues = z.infer<typeof caseDiagnosisFormSchema>

export function toCaseDiagnosisUpdatePayload(values: CaseDiagnosisFormValues): CaseDiagnosisUpdatePayload {
  return {
    icd10_code: values.code.toUpperCase(),
    description: values.description === '' ? null : values.description,
  }
}

const FIELDS: Readonly<Record<string, string>> = { icd10_code: 'code' }

/** Backend field → form field, so a server's field error lands on the right input. */
export const caseDiagnosisFormFieldFor = (path: string): string => FIELDS[path] ?? path

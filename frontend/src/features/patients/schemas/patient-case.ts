import { z } from 'zod'

/**
 * A patient's case, as the backend sends and takes it (contract given
 * 2026-10-08 — not final: a new version is coming — tried on staging with a
 * made-up patient):
 *
 * - `GET /patient-cases?page=N` → Laravel pagination of `{ id, patient_id,
 *   name, referring_physician_id, icd10_codes, injury_type, injury_type_label,
 *   injury_date, start_of_care, discharge_date, accident_state, is_active,
 *   referring_physician, insurances, created_at, updated_at }`;
 *   `GET /patient-cases/{id}` → the same, with the `patient`;
 * - `POST /patient-cases` `{ patient_id, name, referring_physician_id,
 *   injury_type, injury_date, accident_state, start_of_care, discharge_date }`;
 *   `PUT /patient-cases/{id}` — without `patient_id` (refused); `DELETE`.
 *   Writes answer `{ success, message, data: null }` — no new id.
 *
 * Seen on staging: required are the patient and the name (at most 100
 * characters, unique for the patient). The referring physician must be an
 * active one of the patient's practice. `injury_type` is `auto` (Auto
 * Accident), `employment` (Employment Related) or `other`; an auto accident
 * needs an accident state (Box 10b); the injury date is not after today; the
 * discharge date not before the start of care. `icd10_codes` holds up to 12
 * valid ICD-10-CM codes, none twice, kept in the order sent — the position is
 * the claim's pointer. `is_active` (open or closed) is taken. A `PUT` changes
 * only the fields it carries. Every new patient comes with a "Default" case;
 * deleting a patient deletes their cases.
 *
 * Not taken, so not here: the employment status (ignored if sent), and the
 * case's insurances (`insurances` comes back empty; sending it is ignored) —
 * the primary and secondary are kept in this tab with the coverage list.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

export const patientCaseResponseSchema = z
  .object({
    id: z.number().int(),
    patient_id: z.number().int(),
    name: z.string(),
    referring_physician_id: z.number().int().nullable().optional(),
    icd10_codes: z.array(z.string()).nullable().optional(),
    // A string, not an enum: a value the frontend does not know yet must not
    // make the whole list fail to load. Known values: model/case.ts.
    injury_type: text,
    injury_type_label: text,
    injury_date: text,
    start_of_care: text,
    discharge_date: text,
    accident_state: text,
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: String(wire.id),
    patientId: String(wire.patient_id),
    name: wire.name,
    referrerId: wire.referring_physician_id ?? null,
    icd10Codes: wire.icd10_codes ?? [],
    injuryType: wire.injury_type,
    injuryTypeLabel: wire.injury_type_label,
    injuryDate: wire.injury_date,
    startOfCare: wire.start_of_care,
    dischargeDate: wire.discharge_date,
    accidentState: wire.accident_state,
    isActive: wire.is_active,
  }))

/** A case as the server holds it — without what this tab adds (insurance, descriptions). */
export type ServerCase = z.output<typeof patientCaseResponseSchema>

export const patientCasePageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(patientCaseResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ cases: data.data, pageCount: data.meta.last_page }))

/** Saving a case (`PUT`): everything but the patient. */
export interface PatientCaseUpdatePayload {
  name: string
  referring_physician_id: number | null
  injury_type: string | null
  injury_date: string | null
  accident_state: string | null
  start_of_care: string | null
  discharge_date: string | null
  is_active: boolean
}

/** Creating a case (`POST`): with its patient. */
export interface PatientCasePayload extends PatientCaseUpdatePayload {
  patient_id: number
}

/** Exceptions' fixes: only the fields a fix changes. */
export type PatientCaseFieldsPayload = Partial<
  Pick<PatientCaseUpdatePayload, 'referring_physician_id' | 'injury_date'>
>

const FIELDS: Readonly<Record<string, string>> = {
  referring_physician_id: 'referrerId',
  injury_type: 'injuryType',
  injury_date: 'injuryDate',
  accident_state: 'accidentState',
  start_of_care: 'startOfCare',
  discharge_date: 'dischargeDate',
  is_active: 'isActive',
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const patientCaseFormFieldFor = (path: string): string => FIELDS[path] ?? path

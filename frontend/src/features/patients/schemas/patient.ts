import { z } from 'zod'
import type { Guarantor, Patient, PatientSummary } from '../model/patient'

/**
 * A patient, as the backend sends and takes them (contracts confirmed
 * 2026-10-08, tried on staging with made-up patients):
 *
 * - `GET /patients?page=N` → Laravel pagination of a summary: `{ id,
 *   practice_id, emr_id, first_name, middle_name, last_name, date_of_birth,
 *   gender, gender_label, ssn (masked), is_active, created_at }`;
 * - `GET /patients/{id}` → the summary plus `address, address_line2, city,
 *   state, zip_code, phone_home, phone_cell, email, guarantor, no_statements,
 *   notes, practice, cases: [{ id, name, is_active }], updated_at`;
 * - `POST /patients` (the payload below, with `practice_id`), `PUT
 *   /patients/{id}` (without it — refused), `DELETE`. Writes answer `{ success,
 *   message, data: null }` — a new patient's id is **not** returned.
 *
 * Seen on staging: required are the practice, first and last name (first at
 * most 35 characters, middle 25), date of birth (not in the future), gender
 * (`M`, `F` or `U` — Male, Female, Unknown), street, city, state (two
 * capitals) and ZIP. The SSN must be a real one (dashes optional); it only
 * ever comes back masked, and a save carrying `""` or `null` **erases** it —
 * so it is sent only when typed. Phones are ten digits (punctuation allowed),
 * stored as digits. The EMR ID is a number, unique, and may change. A
 * guarantor needs a first and last name and a relationship (Spouse, Parent,
 * Legal Guardian or Other); their date of birth and address are optional, but
 * an address needs all four parts; `guarantor: null` removes them. Optional
 * fields take `null`. A `PUT` changes only the fields it carries. Every new
 * patient comes with a "Default" case. `no_statements` (true: no statements
 * are sent) is false when left out — kept although the client removed the
 * prototype's billing preferences (Q-091): the contract carries it (user,
 * 2026-10-08).
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

const summaryShape = {
  id: z.number().int(),
  practice_id: z.number().int(),
  emr_id: z.number().int().nullable().optional(),
  first_name: z.string(),
  middle_name: text,
  last_name: z.string(),
  date_of_birth: z.string(),
  // A string, not an enum: a value the frontend does not know yet must not
  // make the whole list fail to load. Known values: model/patient.ts.
  gender: text,
  gender_label: text,
  /** Masked by the server ("***-**-6789"), or null. */
  ssn: text,
  is_active: z.boolean(),
}

const toSummary = (wire: z.output<z.ZodObject<typeof summaryShape>>): PatientSummary => ({
  id: String(wire.id),
  billingId: wire.id,
  practiceId: wire.practice_id,
  emrId: wire.emr_id ?? null,
  firstName: wire.first_name,
  middleName: wire.middle_name,
  lastName: wire.last_name,
  dob: wire.date_of_birth,
  gender: wire.gender,
  genderLabel: wire.gender_label,
  maskedSsn: wire.ssn,
  isActive: wire.is_active,
})

export const patientSummarySchema = z.object(summaryShape).transform(toSummary)

const guarantorSchema = z
  .object({
    first_name: text,
    last_name: text,
    relationship: text,
    date_of_birth: text,
    address: z
      .object({ line1: text, city: text, state: text, zip: text })
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .transform((wire): Guarantor => ({
    firstName: wire.first_name,
    lastName: wire.last_name,
    relationship: wire.relationship,
    dob: wire.date_of_birth,
    address: wire.address,
  }))

export const patientSchema = z
  .object({
    ...summaryShape,
    address: text,
    address_line2: text,
    city: text,
    state: text,
    zip_code: text,
    phone_home: text,
    phone_cell: text,
    email: text,
    guarantor: guarantorSchema.nullable().optional(),
    notes: text,
    no_statements: z
      .boolean()
      .nullable()
      .optional()
      .transform((value) => value ?? false),
    cases: z
      .array(z.object({ id: z.number().int(), name: z.string(), is_active: z.boolean() }))
      .nullable()
      .optional(),
  })
  .transform((wire): Patient => ({
    ...toSummary(wire),
    phoneHome: wire.phone_home,
    phoneCell: wire.phone_cell,
    email: wire.email,
    address: {
      line1: wire.address,
      line2: wire.address_line2,
      city: wire.city,
      state: wire.state,
      zip: wire.zip_code,
    },
    guarantor: wire.guarantor ?? null,
    notes: wire.notes,
    noStatements: wire.no_statements,
    cases: (wire.cases ?? []).map((item) => ({
      id: String(item.id),
      name: item.name,
      isActive: item.is_active,
    })),
  }))

export const patientPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(patientSummarySchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ patients: data.data, pageCount: data.meta.last_page }))

export const patientDetailResponseSchema = z.object({ data: patientSchema }).transform((wire) => wire.data)

export interface GuarantorPayload {
  first_name: string
  last_name: string
  relationship: string
  date_of_birth: string | null
  address: { line1: string; city: string; state: string; zip: string } | null
}

/** Saving a patient (`PUT`): everything but the practice. `ssn` only when typed — empty would erase it. */
export interface PatientUpdatePayload {
  emr_id: number | null
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string
  gender: string
  ssn?: string
  address: string
  address_line2: string | null
  city: string
  state: string
  zip_code: string
  phone_home: string | null
  phone_cell: string | null
  email: string | null
  guarantor: GuarantorPayload | null
  notes: string | null
  no_statements: boolean
}

/** Creating a patient (`POST`): with their practice. */
export interface PatientPayload extends PatientUpdatePayload {
  practice_id: number
}

/** Exceptions' fixes: only the fields a fix changes. */
export type PatientFieldsPayload = Partial<
  Pick<
    PatientUpdatePayload,
    | 'first_name'
    | 'middle_name'
    | 'last_name'
    | 'address'
    | 'city'
    | 'state'
    | 'zip_code'
    | 'phone_home'
    | 'phone_cell'
  >
>

const FIELDS: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  emr_id: 'emrId',
  first_name: 'firstName',
  middle_name: 'middleName',
  last_name: 'lastName',
  date_of_birth: 'dob',
  address: 'line1',
  address_line2: 'line2',
  zip_code: 'zip',
  phone_home: 'phoneHome',
  phone_cell: 'phoneCell',
  'guarantor.first_name': 'guarantorFirstName',
  'guarantor.last_name': 'guarantorLastName',
  'guarantor.relationship': 'guarantorRelationship',
  'guarantor.date_of_birth': 'guarantorDob',
  'guarantor.address': 'guarantorLine1',
  'guarantor.address.line1': 'guarantorLine1',
  'guarantor.address.city': 'guarantorCity',
  'guarantor.address.state': 'guarantorState',
  'guarantor.address.zip': 'guarantorZip',
  no_statements: 'noStatements',
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const patientFormFieldFor = (path: string): string => FIELDS[path] ?? path

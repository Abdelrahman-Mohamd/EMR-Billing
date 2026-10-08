import { z } from 'zod'
import { isDummyNpi } from '@/lib/validation/npi'

/**
 * A provider, as the backend sends and takes them (contracts confirmed
 * 2026-10-08, tried on staging):
 *
 * - `GET /providers?page=N` → Laravel pagination of `{ id, practice_id, code,
 *   first_name, last_name, type, type_label, credential, specialty, npi,
 *   taxonomy_code, state_license, is_active, practice, created_at }`;
 *   `GET /providers/{id}` → the same;
 * - `POST /providers` `{ practice_id, code, first_name, last_name, credential,
 *   specialty, npi, taxonomy_code, state_license }`; `PUT /providers/{id}` —
 *   the same without `practice_id` (refused: a provider never moves practice);
 *   `DELETE`. Writes answer `{ success, message, data: null }`.
 *
 * Seen on staging: required are the practice, code, first and last name and
 * NPI; credential, specialty, taxonomy code and state license are optional
 * (`null` or `""` clears them). `type` is `rendering` or `billing` — rendering
 * when left out, `null` refused; `is_active` is taken on both writes although
 * not in the example. The NPI is ten digits and not a placeholder; the
 * taxonomy code is ten characters (225100000X); the code and the NPI are each
 * unique. Specialty is free text. A `PUT` changes only the fields it carries.
 *
 * The prototype's claim hold (from, until, reason, and the locations and
 * payers it covers) is not in the contract, so it is not here.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

export const providerResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    code: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    // A string, not an enum: a value the frontend does not know yet must not
    // make the whole list fail to load. Known values: model/provider-options.ts.
    type: z.string(),
    type_label: text,
    credential: text,
    specialty: text,
    npi: z.string(),
    taxonomy_code: text,
    state_license: text,
    is_active: z.boolean(),
    practice: z.object({ name: z.string() }).nullable().optional(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    /** The practice's name, as the provider comes with it; empty if it did not. */
    practiceName: wire.practice?.name ?? '',
    code: wire.code,
    firstName: wire.first_name,
    lastName: wire.last_name,
    type: wire.type,
    /** The type as the server words it: "Rendering", "Billing". */
    typeLabel: wire.type_label,
    credential: wire.credential,
    specialty: wire.specialty,
    npi: wire.npi,
    taxonomyCode: wire.taxonomy_code,
    stateLicense: wire.state_license,
    isActive: wire.is_active,
  }))

export type Provider = z.output<typeof providerResponseSchema>

export const providerPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(providerResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ providers: data.data, pageCount: data.meta.last_page }))

export const providerDetailResponseSchema = z
  .object({ data: providerResponseSchema })
  .transform((wire) => wire.data)

/** Saving a provider (`PUT`): every field but `practice_id`. */
export interface ProviderUpdatePayload {
  code: string
  first_name: string
  last_name: string
  type: string
  credential: string | null
  specialty: string | null
  npi: string
  taxonomy_code: string | null
  state_license: string | null
  is_active: boolean
}

/** Creating a provider (`POST`): with the practice they belong to. */
export interface ProviderPayload extends ProviderUpdatePayload {
  practice_id: number
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const PROVIDER_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  first_name: 'firstName',
  last_name: 'lastName',
  taxonomy_code: 'taxonomyCode',
  state_license: 'stateLicense',
  is_active: 'isActive',
}

const required = (message: string) => z.string().trim().min(1, message)
// `: boolean` keeps TypeScript from reading the check as a type guard, so the
// form's values stay `string | null` before and after validation.
const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, message)

/**
 * What the form accepts — as the server does:
 * - **Required:** practice, first and last name, Provider ID, NPI and provider
 *   type (rendering to start; the server refuses none). Credential, specialty,
 *   taxonomy code and state license are optional.
 * - **NPI:** ten digits and not a placeholder (BR20; the server refuses them
 *   too). **Taxonomy code:** nine characters and an X, as for practices.
 * - **Not checked:** uniqueness of the Provider ID or NPI — the server's.
 */
export const providerFormSchema = z.object({
  practiceId: chosen('Select a practice.'),
  firstName: required('Enter the first name.'),
  lastName: required('Enter the last name.'),
  credential: z.string().trim(),
  code: required('Enter the Provider ID.'),
  specialty: z.string().nullable(),
  type: chosen('Select a provider type.'),
  npi: required('Enter the NPI.')
    .regex(/^\d{10}$/, 'Please enter a valid NPI.')
    .refine((value) => !isDummyNpi(value), 'Please enter a valid NPI.'),
  taxonomyCode: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[0-9A-Z]{9}X$/.test(value), 'Please enter a valid taxonomy code.'),
  stateLicense: z.string().trim(),
  isActive: z.boolean(),
})

export type ProviderFormValues = z.infer<typeof providerFormSchema>

/** A new provider starts as the prototype's does — minus its invented next Provider ID. */
export const NEW_PROVIDER_VALUES: Omit<ProviderFormValues, 'practiceId'> = {
  firstName: '',
  lastName: '',
  credential: '',
  code: '',
  specialty: 'PHYSICAL THERAPIST',
  type: 'rendering',
  npi: '',
  taxonomyCode: '225100000X',
  stateLicense: '',
  isActive: true,
}

/** A saved provider as the form holds them. */
export function toProviderFormValues(provider: Provider): ProviderFormValues {
  return {
    practiceId: String(provider.practiceId),
    firstName: provider.firstName,
    lastName: provider.lastName,
    credential: provider.credential,
    code: provider.code,
    specialty: provider.specialty === '' ? null : provider.specialty,
    type: provider.type === '' ? null : provider.type,
    npi: provider.npi,
    taxonomyCode: provider.taxonomyCode,
    stateLicense: provider.stateLicense,
    isActive: provider.isActive,
  }
}

const orNull = (value: string | null) => (value === null || value === '' ? null : value)

/** A save: every field but the practice, which a provider never changes. */
export function toProviderUpdatePayload(values: ProviderFormValues): ProviderUpdatePayload {
  // The schema has refused a missing type before this runs.
  return {
    code: values.code,
    first_name: values.firstName,
    last_name: values.lastName,
    type: values.type ?? '',
    credential: orNull(values.credential),
    specialty: orNull(values.specialty),
    npi: values.npi,
    taxonomy_code: orNull(values.taxonomyCode),
    state_license: orNull(values.stateLicense),
    is_active: values.isActive,
  }
}

/** A new provider: with their practice. */
export function toProviderPayload(values: ProviderFormValues): ProviderPayload {
  // The schema has refused a missing practice before this runs.
  return { practice_id: Number(values.practiceId), ...toProviderUpdatePayload(values) }
}

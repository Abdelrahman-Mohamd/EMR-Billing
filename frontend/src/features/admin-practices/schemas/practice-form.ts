import { z } from 'zod'

/**
 * What the practice and location forms accept.
 *
 * Only what is known is checked:
 * - **Required** — the fields the prototype requires and the payloads always
 *   carry. DBA, suite (`line2`), organization and place of service are
 *   optional: the payload examples leave them out.
 * - **Formats** — the prototype's own checks and messages: NPI is ten digits,
 *   ZIP five, state two letters, taxonomy nine characters and an X, Tax ID an
 *   EIN (00-0000000) or SSN (000-00-0000) — PRD F01 allows either.
 *
 * Not checked, because nothing confirms them: uniqueness of any code or NPI
 * (V2 makes a location code unique within its practice; the server enforces it
 * and its rejection lands on the field), NPI check digits, or any rule tying
 * one record to another.
 */
const required = (message: string) => z.string().trim().min(1, message)

const npi = required('Enter the NPI.').regex(/^\d{10}$/, 'Please enter a valid NPI.')

const addressFields = {
  line1: required('Enter the street address.'),
  city: required('Enter the city.'),
  state: required('Enter the state.')
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Please enter a valid state.'),
  zip: required('Enter the ZIP code.').regex(/^\d{5}$/, 'Please enter a valid ZIP code.'),
}

/** A practice address has a suite line; the location payloads show none. */
export const practiceAddressFormSchema = z.object({ ...addressFields, line2: z.string().trim() })
export const locationAddressFormSchema = z.object(addressFields)

/** A location's own fields — shared by "Add location" and a new practice's first location. */
export const locationFieldsSchema = z.object({
  code: required('Enter the location code.'),
  name: required('Enter the location name.'),
  npi,
  address: locationAddressFormSchema,
  /** `null`: none chosen — left out of the payload. */
  placeOfService: z.string().nullable(),
})

export const locationFormSchema = locationFieldsSchema.extend({ isActive: z.boolean() })

export const practiceFormSchema = z.object({
  /** An organization id as the select holds it, or `null` for none. */
  organizationId: z.string().nullable(),
  code: required('Enter the practice code.'),
  name: required('Enter the practice name.'),
  dbaName: z.string().trim(),
  npi,
  taxId: required('Enter the Tax ID.').regex(
    /^(\d{2}-\d{7}|\d{3}-\d{2}-\d{4})$/,
    // The format belongs in the message: it is what the user needs at that moment.
    'Enter an EIN (00-0000000) or an SSN (000-00-0000).',
  ),
  taxonomyCode: required('Enter the taxonomy code.')
    .toUpperCase()
    .regex(/^[0-9A-Z]{9}X$/, 'Please enter a valid taxonomy code.'),
  address: practiceAddressFormSchema,
  isActive: z.boolean(),
})

/**
 * A new practice is created together with its first location: PRD V2 §1.2
 * (BR01) requires at least one location per practice, and the practice
 * payload carries `locations[]`.
 */
export const newPracticeFormSchema = practiceFormSchema.extend({ location: locationFieldsSchema })

export type LocationFieldsValues = z.infer<typeof locationFieldsSchema>
export type LocationFormValues = z.infer<typeof locationFormSchema>
export type PracticeFormValues = z.infer<typeof practiceFormSchema>
export type NewPracticeFormValues = z.infer<typeof newPracticeFormSchema>

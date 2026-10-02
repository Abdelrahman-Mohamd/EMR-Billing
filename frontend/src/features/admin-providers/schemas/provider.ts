import { z } from 'zod'
import { isDummyNpi } from '@/lib/validation/npi'
import type { ClaimHold } from '../model/claim-hold'

/**
 * A provider as the screens see it, parsed from the wire.
 *
 * **Provisional contract.** No backend payload exists for providers. The
 * fields are the updated prototype's provider form, field for field, under
 * the PRD V2 column names of `provider` (§10.3) where V2 has one: code
 * (labelled Provider ID), first and last name, credential, specialty, NPI,
 * taxonomy code, state license, claim hold until and reason, active — plus
 * `provider_type` (client, 2026-09-30). Named here because V2 has no column:
 * `practice_id` (a provider belongs to a practice in the prototype),
 * `claim_hold_from`, `claim_hold_location_ids` and `claim_hold_insurance_ids`
 * (the hold's window and scope, client 2026-09-23). When the real payload
 * arrives, this file and `api/` change — nothing else.
 *
 * Not here, on purpose: payer enrollment / credentialing (removed by the
 * client, 2026-09-30), and the prototype's "draft from EMR" profiles, which
 * only an EMR import creates.
 *
 * Assumed until a contract says otherwise: a saved provider comes back as its
 * payload plus a numeric `id`; an empty optional text is sent as `null`.
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
    credential: text,
    specialty: z.string(),
    // A string, not an enum: a value the frontend does not know yet must not
    // make the whole list fail to load.
    provider_type: z.string(),
    npi: z.string(),
    taxonomy_code: z.string(),
    state_license: text,
    claim_hold_from: z.string().nullable(),
    claim_hold_until: z.string().nullable(),
    claim_hold_reason: text,
    claim_hold_location_ids: z.array(z.number().int()),
    claim_hold_insurance_ids: z.array(z.number().int()),
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    code: wire.code,
    firstName: wire.first_name,
    lastName: wire.last_name,
    credential: wire.credential,
    specialty: wire.specialty,
    providerType: wire.provider_type,
    npi: wire.npi,
    taxonomyCode: wire.taxonomy_code,
    stateLicense: wire.state_license,
    claimHold: {
      from: wire.claim_hold_from,
      until: wire.claim_hold_until,
      reason: wire.claim_hold_reason,
      locationIds: wire.claim_hold_location_ids,
      insuranceIds: wire.claim_hold_insurance_ids,
    } satisfies ClaimHold,
    isActive: wire.is_active,
  }))

export type Provider = z.output<typeof providerResponseSchema>

/** The request body for create and update (provisional — see above). */
export interface ProviderPayload {
  practice_id: number
  code: string
  first_name: string
  last_name: string
  credential: string | null
  specialty: string
  provider_type: string
  npi: string
  taxonomy_code: string
  state_license: string | null
  claim_hold_from: string | null
  claim_hold_until: string | null
  claim_hold_reason: string | null
  claim_hold_location_ids: number[]
  claim_hold_insurance_ids: number[]
  is_active: boolean
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const PROVIDER_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  first_name: 'firstName',
  last_name: 'lastName',
  provider_type: 'providerType',
  taxonomy_code: 'taxonomyCode',
  state_license: 'stateLicense',
  claim_hold_from: 'claimHoldFrom',
  claim_hold_until: 'claimHoldUntil',
  claim_hold_reason: 'claimHoldReason',
  claim_hold_location_ids: 'claimHoldLocationIds',
  claim_hold_insurance_ids: 'claimHoldInsuranceIds',
  is_active: 'isActive',
}

const required = (message: string) => z.string().trim().min(1, message)
const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, message)

/**
 * What the form accepts — the prototype's checks, and only those:
 * - **Required:** practice, first and last name, Provider ID, specialty,
 *   provider type, NPI and taxonomy code. Credential and state license are
 *   optional.
 * - **NPI:** ten digits and not a placeholder NPI (BR20), as for referring
 *   physicians.
 * - **Claim hold:** a hold exists once it has an end date; then it needs a
 *   start date and a reason, and cannot end before it starts.
 * - **Not checked:** uniqueness of the Provider ID or NPI, taxonomy format,
 *   anything about the type — the server's, or not defined.
 */
export const providerFormSchema = z
  .object({
    practiceId: chosen('Select a practice.'),
    firstName: required('Enter the first name.'),
    lastName: required('Enter the last name.'),
    credential: z.string().trim(),
    code: required('Enter the Provider ID.'),
    specialty: chosen('Select a specialty.'),
    providerType: chosen('Select a provider type.'),
    npi: required('Enter the NPI.').refine(
      (value) => value === '' || (/^\d{10}$/.test(value) && !isDummyNpi(value)),
      'Please enter a valid NPI.',
    ),
    taxonomyCode: required('Enter the taxonomy code.'),
    stateLicense: z.string().trim(),
    /** ISO dates; empty means none. */
    claimHoldFrom: z.string(),
    claimHoldUntil: z.string(),
    claimHoldReason: z.string().trim(),
    claimHoldLocationIds: z.array(z.string()),
    claimHoldInsuranceIds: z.array(z.string()),
    isActive: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.claimHoldUntil === '') return
    if (values.claimHoldFrom === '') {
      context.addIssue({
        code: 'custom',
        path: ['claimHoldFrom'],
        message: 'Enter the date the hold starts.',
      })
    } else if (values.claimHoldUntil < values.claimHoldFrom) {
      context.addIssue({ code: 'custom', path: ['claimHoldUntil'], message: 'Please enter a valid date.' })
    }
    if (values.claimHoldReason === '') {
      context.addIssue({
        code: 'custom',
        path: ['claimHoldReason'],
        message: 'Enter the reason for the hold.',
      })
    }
  })

export type ProviderFormValues = z.infer<typeof providerFormSchema>

/** A new provider starts as the prototype's does — minus its invented next Provider ID. */
export const NEW_PROVIDER_VALUES: Omit<ProviderFormValues, 'practiceId'> = {
  firstName: '',
  lastName: '',
  credential: '',
  code: '',
  specialty: 'PHYSICAL THERAPIST',
  providerType: null,
  npi: '',
  taxonomyCode: '225100000X',
  stateLicense: '',
  claimHoldFrom: '',
  claimHoldUntil: '',
  claimHoldReason: '',
  claimHoldLocationIds: [],
  claimHoldInsuranceIds: [],
  isActive: true,
}

export function toProviderFormValues(provider: Provider): ProviderFormValues {
  return {
    practiceId: String(provider.practiceId),
    firstName: provider.firstName,
    lastName: provider.lastName,
    credential: provider.credential,
    code: provider.code,
    specialty: provider.specialty,
    providerType: provider.providerType === '' ? null : provider.providerType,
    npi: provider.npi,
    taxonomyCode: provider.taxonomyCode,
    stateLicense: provider.stateLicense,
    claimHoldFrom: provider.claimHold.from ?? '',
    claimHoldUntil: provider.claimHold.until ?? '',
    claimHoldReason: provider.claimHold.reason,
    claimHoldLocationIds: provider.claimHold.locationIds.map(String),
    claimHoldInsuranceIds: provider.claimHold.insuranceIds.map(String),
    isActive: provider.isActive,
  }
}

const orNull = (value: string) => (value === '' ? null : value)

export function toProviderPayload(values: ProviderFormValues): ProviderPayload {
  // As the prototype saves it: without an end date there is no hold, so its
  // other fields are cleared rather than kept half-filled.
  const held = values.claimHoldUntil !== ''
  // The schema has refused a missing practice, specialty or type before this runs.
  return {
    practice_id: Number(values.practiceId),
    code: values.code,
    first_name: values.firstName,
    last_name: values.lastName,
    credential: orNull(values.credential),
    specialty: values.specialty ?? '',
    provider_type: values.providerType ?? '',
    npi: values.npi,
    taxonomy_code: values.taxonomyCode,
    state_license: orNull(values.stateLicense),
    claim_hold_from: held ? orNull(values.claimHoldFrom) : null,
    claim_hold_until: held ? values.claimHoldUntil : null,
    claim_hold_reason: held ? values.claimHoldReason : null,
    claim_hold_location_ids: held ? values.claimHoldLocationIds.map(Number) : [],
    claim_hold_insurance_ids: held ? values.claimHoldInsuranceIds.map(Number) : [],
    is_active: values.isActive,
  }
}

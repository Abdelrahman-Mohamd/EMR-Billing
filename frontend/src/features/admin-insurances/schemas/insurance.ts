import { z } from 'zod'
import {
  BOOLEAN_RULES,
  CLAIM_FORMATS,
  ICD_VERSIONS,
  type BooleanRuleKey,
  type RuleOverrides,
} from '../model/rules'

/**
 * An insurance — a payer as a practice bills it — as the screens see it,
 * parsed from the wire.
 *
 * **Provisional contract.** No backend payload exists for insurances. The
 * fields are the updated prototype's insurance form, field for field, written
 * under the PRD V2 column names of `insurance` (§10.3) where V2 has one:
 * class, code, name, insurance type, payer ID, address, phone, fax, the five
 * rule overrides (`null` = inherit), insurance hold and release bucket, and
 * the payer portal link. Four have no V2 column and are named here:
 * `audit_required` (client, 2026-09-23), `claim_format`, `max_units` and
 * `sla_days` (prototype settings with no home in V2 — Q-011, Q-040).
 *
 * The payer portal is a link only (client, 2026-09-30): no portal user or
 * password is read, sent or shown, although V2 keeps both, encrypted.
 *
 * Assumed until a contract says otherwise: a saved insurance comes back as its
 * payload plus a numeric `id`; an empty optional text is sent as `null`; the
 * address is one object whose parts may be empty.
 */
const nullableText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

export const insuranceResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    insurance_class_id: z.number().int(),
    code: z.number().int(),
    name: z.string(),
    insurance_type: z.string(),
    payer_id: z.string(),
    address: z.object({ line1: nullableText, city: nullableText, state: nullableText, zip: nullableText }),
    phone: nullableText,
    fax: nullableText,
    authorization_required: z.boolean().nullable(),
    injury_date_required: z.boolean().nullable(),
    apply_specialty_modifiers: z.boolean().nullable(),
    accept_assignment: z.boolean().nullable(),
    icd_version: z.string().nullable(),
    insurance_hold: z.boolean(),
    release_bucket_id: z.number().int().nullable(),
    audit_required: z.boolean(),
    claim_format: z.string(),
    max_units: z.number().int(),
    sla_days: z.number().int(),
    portal_url: nullableText,
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    insuranceClassId: wire.insurance_class_id,
    code: wire.code,
    name: wire.name,
    insuranceType: wire.insurance_type,
    payerId: wire.payer_id,
    address: wire.address,
    phone: wire.phone,
    fax: wire.fax,
    rules: {
      authorizationRequired: wire.authorization_required,
      injuryDateRequired: wire.injury_date_required,
      applySpecialtyModifiers: wire.apply_specialty_modifiers,
      acceptAssignment: wire.accept_assignment,
      icdVersion: wire.icd_version,
    } satisfies RuleOverrides,
    insuranceHold: wire.insurance_hold,
    releaseBucketId: wire.release_bucket_id,
    auditRequired: wire.audit_required,
    claimFormat: wire.claim_format,
    maxUnits: wire.max_units,
    slaDays: wire.sla_days,
    portalUrl: wire.portal_url,
    isActive: wire.is_active,
  }))

export type Insurance = z.output<typeof insuranceResponseSchema>

/** The request body for create and update (provisional — see above). */
export interface InsurancePayload {
  practice_id: number
  insurance_class_id: number
  code: number
  name: string
  insurance_type: string
  payer_id: string
  address: { line1: string; city: string; state: string; zip: string }
  phone: string | null
  fax: string | null
  authorization_required: boolean | null
  injury_date_required: boolean | null
  apply_specialty_modifiers: boolean | null
  accept_assignment: boolean | null
  icd_version: string | null
  insurance_hold: boolean
  release_bucket_id: number | null
  audit_required: boolean
  claim_format: string
  max_units: number
  sla_days: number
  portal_url: string | null
  is_active: boolean
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const INSURANCE_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  insurance_class_id: 'insuranceClassId',
  insurance_type: 'insuranceType',
  payer_id: 'payerId',
  authorization_required: 'authorizationRequired',
  injury_date_required: 'injuryDateRequired',
  apply_specialty_modifiers: 'applySpecialtyModifiers',
  accept_assignment: 'acceptAssignment',
  icd_version: 'icdVersion',
  insurance_hold: 'insuranceHold',
  release_bucket_id: 'releaseBucketId',
  audit_required: 'auditRequired',
  claim_format: 'claimFormat',
  max_units: 'maxUnits',
  sla_days: 'slaDays',
  portal_url: 'portalUrl',
  is_active: 'isActive',
}

/** A rule on the form: inherit the class value, or override it. */
export const RULE_CHOICES = ['inherit', 'yes', 'no'] as const
export type RuleChoice = (typeof RULE_CHOICES)[number]

const toChoice = (value: boolean | null): RuleChoice => (value === null ? 'inherit' : value ? 'yes' : 'no')
const fromChoice = (choice: RuleChoice): boolean | null => (choice === 'inherit' ? null : choice === 'yes')

const required = (message: string) => z.string().trim().min(1, message)
/** Empty, or in this format — the prototype's optional fields. */
const optionalMatching = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), message)
const wholeNumberBetween = (min: number, max: number, message: string) =>
  required(message).refine(
    (value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max,
    message,
  )
const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, message)

/**
 * What the form accepts — the prototype's checks, and only those:
 * - **Required:** practice, code (a whole number), name, insurance class,
 *   insurance type, payer ID, claim format, max units (1–20) and SLA days
 *   (1–365); a release bucket while the insurance hold is on (PRD V2 CH-01).
 * - **Formats, when filled:** state two letters, ZIP five digits, phone and
 *   fax 000-000-0000.
 * - **Not checked:** the payer portal link (the client gave no rule), code
 *   uniqueness within a practice (the server's), and whether the class and
 *   bucket belong to the practice (the pickers only offer the practice's own).
 */
export const insuranceFormSchema = z
  .object({
    practiceId: chosen('Select a practice.'),
    code: required('Enter the insurance code.').refine(
      (value) => value === '' || /^\d+$/.test(value),
      'Enter the code as a whole number.',
    ),
    name: required('Enter the insurance name.'),
    insuranceClassId: chosen('Select an insurance class.'),
    insuranceType: chosen('Select an insurance type.'),
    payerId: required('Enter the payer ID.'),
    address: z.object({
      line1: z.string().trim(),
      city: z.string().trim(),
      state: optionalMatching(/^[A-Z]{2}$/, 'Please enter a valid state.'),
      zip: optionalMatching(/^\d{5}$/, 'Please enter a valid ZIP code.'),
    }),
    phone: optionalMatching(/^\d{3}-\d{3}-\d{4}$/, 'Enter the phone number as 000-000-0000.'),
    fax: optionalMatching(/^\d{3}-\d{3}-\d{4}$/, 'Enter the fax number as 000-000-0000.'),
    authorizationRequired: z.enum(RULE_CHOICES),
    injuryDateRequired: z.enum(RULE_CHOICES),
    applySpecialtyModifiers: z.enum(RULE_CHOICES),
    acceptAssignment: z.enum(RULE_CHOICES),
    /** `inherit`, or one of the ICD versions. */
    icdVersion: z.enum(['inherit', ...ICD_VERSIONS]),
    insuranceHold: z.boolean(),
    releaseBucketId: z.string().nullable(),
    auditRequired: z.boolean(),
    claimFormat: z.enum(CLAIM_FORMATS.map((format) => format.value)),
    maxUnits: wholeNumberBetween(1, 20, 'Enter a number from 1 to 20.'),
    slaDays: wholeNumberBetween(1, 365, 'Enter a number of days from 1 to 365.'),
    portalUrl: z.string().trim(),
    isActive: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.insuranceHold && values.releaseBucketId === null) {
      context.addIssue({ code: 'custom', path: ['releaseBucketId'], message: 'Select a release bucket.' })
    }
  })

export type InsuranceFormValues = z.infer<typeof insuranceFormSchema>

/** A new insurance starts as the prototype's does. */
export const NEW_INSURANCE_VALUES: Omit<InsuranceFormValues, 'practiceId'> = {
  code: '',
  name: '',
  insuranceClassId: null,
  insuranceType: null,
  payerId: '',
  address: { line1: '', city: '', state: '', zip: '' },
  phone: '',
  fax: '',
  authorizationRequired: 'inherit',
  injuryDateRequired: 'inherit',
  applySpecialtyModifiers: 'inherit',
  acceptAssignment: 'inherit',
  icdVersion: 'inherit',
  insuranceHold: false,
  releaseBucketId: null,
  auditRequired: false,
  claimFormat: '837P',
  maxUnits: '6',
  slaDays: '30',
  portalUrl: '',
  isActive: true,
}

export function toInsuranceFormValues(insurance: Insurance): InsuranceFormValues {
  const icd = insurance.rules.icdVersion
  return {
    practiceId: String(insurance.practiceId),
    code: String(insurance.code),
    name: insurance.name,
    insuranceClassId: String(insurance.insuranceClassId),
    insuranceType: insurance.insuranceType,
    payerId: insurance.payerId,
    address: { ...insurance.address },
    phone: insurance.phone,
    fax: insurance.fax,
    authorizationRequired: toChoice(insurance.rules.authorizationRequired),
    injuryDateRequired: toChoice(insurance.rules.injuryDateRequired),
    applySpecialtyModifiers: toChoice(insurance.rules.applySpecialtyModifiers),
    acceptAssignment: toChoice(insurance.rules.acceptAssignment),
    // A version this form does not offer reads as inherit rather than breaking the form.
    icdVersion: icd === 'ICD10' || icd === 'ICD9' ? icd : 'inherit',
    insuranceHold: insurance.insuranceHold,
    releaseBucketId: insurance.releaseBucketId === null ? null : String(insurance.releaseBucketId),
    auditRequired: insurance.auditRequired,
    claimFormat: insurance.claimFormat === 'CMS1500' ? 'CMS1500' : '837P',
    maxUnits: String(insurance.maxUnits),
    slaDays: String(insurance.slaDays),
    portalUrl: insurance.portalUrl,
    isActive: insurance.isActive,
  }
}

/** The form's rule choices as overrides — for the effective-values panel and the payload. */
export function formRuleOverrides(
  values: Pick<InsuranceFormValues, BooleanRuleKey | 'icdVersion'>,
): RuleOverrides {
  const overrides = Object.fromEntries(
    BOOLEAN_RULES.map(({ key }) => [key, fromChoice(values[key])]),
  ) as Record<BooleanRuleKey, boolean | null>
  return { ...overrides, icdVersion: values.icdVersion === 'inherit' ? null : values.icdVersion }
}

const orNull = (value: string) => (value === '' ? null : value)

export function toInsurancePayload(values: InsuranceFormValues): InsurancePayload {
  const rules = formRuleOverrides(values)
  // The schema has refused a missing practice, class or type before this runs.
  return {
    practice_id: Number(values.practiceId),
    insurance_class_id: Number(values.insuranceClassId),
    code: Number(values.code),
    name: values.name,
    insurance_type: values.insuranceType ?? '',
    payer_id: values.payerId,
    address: { ...values.address },
    phone: orNull(values.phone),
    fax: orNull(values.fax),
    authorization_required: rules.authorizationRequired,
    injury_date_required: rules.injuryDateRequired,
    apply_specialty_modifiers: rules.applySpecialtyModifiers,
    accept_assignment: rules.acceptAssignment,
    icd_version: rules.icdVersion,
    insurance_hold: values.insuranceHold,
    // Only a held insurance has a bucket (prototype; PRD V2 CH-01).
    release_bucket_id:
      values.insuranceHold && values.releaseBucketId !== null ? Number(values.releaseBucketId) : null,
    audit_required: values.auditRequired,
    claim_format: values.claimFormat,
    max_units: Number(values.maxUnits),
    sla_days: Number(values.slaDays),
    portal_url: orNull(values.portalUrl),
    is_active: values.isActive,
  }
}

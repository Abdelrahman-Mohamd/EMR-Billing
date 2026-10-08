import { z } from 'zod'
import {
  BOOLEAN_RULES,
  CLAIM_FORMATS,
  ICD_VERSIONS,
  INSURANCE_TYPES,
  type BooleanOverrides,
  type BooleanRuleKey,
  type RuleOverrides,
} from '../model/rules'

/**
 * An insurance — a payer as a practice bills it — as the backend sends and
 * takes it (contracts confirmed 2026-10-08, tried on staging):
 *
 * - `GET /insurances?page=N` → Laravel pagination of **summaries**: `{ id,
 *   practice_id, code, name, display_name, insurance_type,
 *   insurance_type_label, payer_id, insurance_hold, authorization_required,
 *   injury_date_required, apply_specialty_modifiers, accept_assignment,
 *   audit_required, is_active, insurance_class: { id, name },
 *   release_bucket: { id, name } | null, created_at }`;
 * - `GET /insurances/{id}` → the whole insurance: plus `insurance_class_id`,
 *   `claim_format`, `payment_sla_days`, the address (`address`,
 *   `address_line2`, `city`, `state`, `zip_code`), `phone`, `fax`,
 *   `icd_version`, `effective_rules`, `release_bucket_id`, `portal_url`, and
 *   the class, bucket and practice records;
 * - `POST /insurances` — the payload below; `PUT /insurances/{id}` — the same
 *   without `practice_id` (refused: an insurance never moves practice);
 *   `DELETE /insurances/{id}`. Writes answer `{ success, message, data: null }`.
 *
 * Seen on staging: required — practice, class, code (an integer), name, type
 * (`payer_id` is optional);
 * the class must be an active class of the same practice; a held insurance
 * needs a release bucket (turning the hold off clears it); phone and fax are
 * 10 digits, stored without punctuation; the payment SLA is 1–365 days; a
 * `PUT` changes only the fields it carries, and `null` clears an optional one.
 * The claim format always has a value — a new insurance without one gets 837P,
 * and a save cannot set none — so the form always holds one, 837P to start.
 *
 * `portal_user` and `portal_password` are **write-only**: sent when typed, never
 * returned, so never shown — a save without them keeps the stored ones.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')
const rule = z
  .boolean()
  .nullable()
  .optional()
  .transform((value) => value ?? null)
const ref = z.object({ id: z.number().int(), name: z.string() })

/** An insurance as the list has it — enough to pick it, name it and list it. */
export const insuranceResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    code: z.number().int(),
    name: z.string(),
    insurance_type: z.string(),
    insurance_type_label: z.string().nullable().optional(),
    payer_id: text,
    insurance_hold: z.boolean(),
    authorization_required: rule,
    injury_date_required: rule,
    apply_specialty_modifiers: rule,
    accept_assignment: rule,
    audit_required: z.boolean(),
    is_active: z.boolean(),
    insurance_class: ref,
    release_bucket: ref.nullable().optional(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    insuranceClassId: wire.insurance_class.id,
    insuranceClassName: wire.insurance_class.name,
    code: wire.code,
    name: wire.name,
    /** The type code ("WC"). */
    insuranceType: wire.insurance_type,
    /** Its label, as the server words it ("Workers' Comp"). */
    insuranceTypeLabel: wire.insurance_type_label ?? wire.insurance_type,
    payerId: wire.payer_id,
    insuranceHold: wire.insurance_hold,
    releaseBucketId: wire.release_bucket?.id ?? null,
    releaseBucketName: wire.release_bucket?.name ?? null,
    rules: {
      authorizationRequired: wire.authorization_required,
      injuryDateRequired: wire.injury_date_required,
      applySpecialtyModifiers: wire.apply_specialty_modifiers,
      acceptAssignment: wire.accept_assignment,
    } satisfies BooleanOverrides,
    auditRequired: wire.audit_required,
    isActive: wire.is_active,
  }))

export type Insurance = z.output<typeof insuranceResponseSchema>

export const insurancePageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(insuranceResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ insurances: data.data, pageCount: data.meta.last_page }))

/** One insurance in full, for the edit form. */
export const insuranceDetailResponseSchema = z
  .object({
    data: z.object({
      id: z.number().int(),
      practice_id: z.number().int(),
      insurance_class_id: z.number().int(),
      code: z.number().int(),
      name: z.string(),
      insurance_type: z.string(),
      payer_id: text,
      claim_format: z.string().nullable().optional(),
      payment_sla_days: z.number().int().nullable().optional(),
      address: text,
      address_line2: text,
      city: text,
      state: text,
      zip_code: text,
      phone: text,
      fax: text,
      authorization_required: rule,
      injury_date_required: rule,
      apply_specialty_modifiers: rule,
      accept_assignment: rule,
      icd_version: z.string().nullable().optional(),
      insurance_hold: z.boolean(),
      audit_required: z.boolean(),
      release_bucket_id: z.number().int().nullable().optional(),
      portal_url: text,
      is_active: z.boolean(),
    }),
  })
  .transform(({ data: wire }) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    insuranceClassId: wire.insurance_class_id,
    code: wire.code,
    name: wire.name,
    insuranceType: wire.insurance_type,
    payerId: wire.payer_id,
    address: {
      line1: wire.address,
      line2: wire.address_line2,
      city: wire.city,
      state: wire.state,
      zip: wire.zip_code,
    },
    phone: wire.phone,
    fax: wire.fax,
    rules: {
      authorizationRequired: wire.authorization_required,
      injuryDateRequired: wire.injury_date_required,
      applySpecialtyModifiers: wire.apply_specialty_modifiers,
      acceptAssignment: wire.accept_assignment,
      icdVersion: wire.icd_version ?? null,
    } satisfies RuleOverrides,
    insuranceHold: wire.insurance_hold,
    releaseBucketId: wire.release_bucket_id ?? null,
    auditRequired: wire.audit_required,
    claimFormat: wire.claim_format ?? null,
    slaDays: wire.payment_sla_days ?? null,
    portalUrl: wire.portal_url,
    isActive: wire.is_active,
  }))

export type InsuranceDetail = z.output<typeof insuranceDetailResponseSchema>

/** Saving an insurance (`PUT`): every field but `practice_id`. */
export interface InsuranceUpdatePayload {
  insurance_class_id: number
  code: number
  name: string
  insurance_type: string
  payer_id: string | null
  address: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
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
  /** Always one: 837P or CMS1500. */
  claim_format: string
  payment_sla_days: number | null
  portal_url: string | null
  /** Write-only; left out when not typed, so the stored one stays. */
  portal_user?: string
  /** Write-only; left out when not typed, so the stored one stays. */
  portal_password?: string
  is_active: boolean
}

/** Creating an insurance (`POST`): with the practice it belongs to. */
export interface InsurancePayload extends InsuranceUpdatePayload {
  practice_id: number
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const INSURANCE_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  insurance_class_id: 'insuranceClassId',
  insurance_type: 'insuranceType',
  payer_id: 'payerId',
  address: 'address.line1',
  address_line2: 'address.line2',
  city: 'address.city',
  state: 'address.state',
  zip_code: 'address.zip',
  authorization_required: 'authorizationRequired',
  injury_date_required: 'injuryDateRequired',
  apply_specialty_modifiers: 'applySpecialtyModifiers',
  accept_assignment: 'acceptAssignment',
  icd_version: 'icdVersion',
  insurance_hold: 'insuranceHold',
  release_bucket_id: 'releaseBucketId',
  audit_required: 'auditRequired',
  claim_format: 'claimFormat',
  payment_sla_days: 'slaDays',
  portal_url: 'portalUrl',
  portal_user: 'portalUser',
  portal_password: 'portalPassword',
  is_active: 'isActive',
}

/** A rule on the form: inherit the class value, or override it. */
export const RULE_CHOICES = ['inherit', 'yes', 'no'] as const
export type RuleChoice = (typeof RULE_CHOICES)[number]

const toChoice = (value: boolean | null): RuleChoice => (value === null ? 'inherit' : value ? 'yes' : 'no')
const fromChoice = (choice: RuleChoice): boolean | null => (choice === 'inherit' ? null : choice === 'yes')

const required = (message: string) => z.string().trim().min(1, message)
/** Empty, or in this format. */
const optionalMatching = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), message)
/** Empty, or ten digits once punctuation is set aside — the server's rule. */
const optionalTenDigits = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || value.replace(/\D/g, '').length === 10, message)
/** Empty, or a whole number in range. */
const optionalWholeNumberBetween = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max),
      message,
    )
const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, message)

/**
 * What the form accepts — the server's rules:
 * - **Required:** practice, code (a whole number), name, insurance class and
 *   insurance type; a release bucket while the insurance hold is on.
 * - **Optional:** payer ID, and the payment SLA — when given, 1–365 days. The
 *   claim format always has one of its two values.
 * - **Formats, when filled:** state two letters, ZIP five digits, phone and
 *   fax ten digits (punctuation allowed).
 * - **Checked by the server only:** code uniqueness within a practice, the
 *   portal link being a URL, the class being an active class of the practice.
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
    payerId: z.string().trim(),
    address: z.object({
      line1: z.string().trim(),
      line2: z.string().trim(),
      city: z.string().trim(),
      state: optionalMatching(/^[A-Z]{2}$/, 'Please enter a valid state.'),
      zip: optionalMatching(/^\d{5}$/, 'Please enter a valid ZIP code.'),
    }),
    phone: optionalTenDigits('Enter a 10-digit phone number.'),
    fax: optionalTenDigits('Enter a 10-digit fax number.'),
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
    slaDays: optionalWholeNumberBetween(1, 365, 'Enter a number of days from 1 to 365.'),
    portalUrl: z.string().trim(),
    /** Write-only: empty leaves the stored one as it is. Not trimmed. */
    portalUser: z.string(),
    /** Write-only: empty leaves the stored one as it is. Not trimmed: a space may be part of it. */
    portalPassword: z.string(),
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
  address: { line1: '', line2: '', city: '', state: '', zip: '' },
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
  // The server's own default.
  claimFormat: '837P',
  slaDays: '',
  portalUrl: '',
  portalUser: '',
  portalPassword: '',
  isActive: true,
}

/** Ten stored digits, shown as 800-555-0199; anything else as it came. */
const showPhone = (value: string) =>
  /^\d{10}$/.test(value) ? `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}` : value

export function toInsuranceFormValues(insurance: InsuranceDetail): InsuranceFormValues {
  const icd = insurance.rules.icdVersion
  return {
    practiceId: String(insurance.practiceId),
    code: String(insurance.code),
    name: insurance.name,
    insuranceClassId: String(insurance.insuranceClassId),
    // A type this form does not offer reads as none rather than breaking the form.
    insuranceType: INSURANCE_TYPES.some((type) => type.value === insurance.insuranceType)
      ? insurance.insuranceType
      : null,
    payerId: insurance.payerId,
    address: { ...insurance.address },
    phone: showPhone(insurance.phone),
    fax: showPhone(insurance.fax),
    authorizationRequired: toChoice(insurance.rules.authorizationRequired),
    injuryDateRequired: toChoice(insurance.rules.injuryDateRequired),
    applySpecialtyModifiers: toChoice(insurance.rules.applySpecialtyModifiers),
    acceptAssignment: toChoice(insurance.rules.acceptAssignment),
    // A version this form does not offer reads as inherit rather than breaking the form.
    icdVersion: icd === 'ICD10' || icd === 'ICD9' ? icd : 'inherit',
    insuranceHold: insurance.insuranceHold,
    releaseBucketId: insurance.releaseBucketId === null ? null : String(insurance.releaseBucketId),
    auditRequired: insurance.auditRequired,
    // Always one of the two; anything else reads as the server's default.
    claimFormat: insurance.claimFormat === 'CMS1500' ? 'CMS1500' : '837P',
    slaDays: insurance.slaDays === null ? '' : String(insurance.slaDays),
    portalUrl: insurance.portalUrl,
    // Never returned: the stored ones are kept unless new ones are typed.
    portalUser: '',
    portalPassword: '',
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

/** A save: every field but the practice, which an insurance never changes. */
export function toInsuranceUpdatePayload(values: InsuranceFormValues): InsuranceUpdatePayload {
  const rules = formRuleOverrides(values)
  // The schema has refused a missing class or type before this runs.
  return {
    insurance_class_id: Number(values.insuranceClassId),
    code: Number(values.code),
    name: values.name,
    insurance_type: values.insuranceType ?? '',
    payer_id: orNull(values.payerId),
    address: orNull(values.address.line1),
    address_line2: orNull(values.address.line2),
    city: orNull(values.address.city),
    state: orNull(values.address.state),
    zip_code: orNull(values.address.zip),
    phone: orNull(values.phone),
    fax: orNull(values.fax),
    authorization_required: rules.authorizationRequired,
    injury_date_required: rules.injuryDateRequired,
    apply_specialty_modifiers: rules.applySpecialtyModifiers,
    accept_assignment: rules.acceptAssignment,
    icd_version: rules.icdVersion,
    insurance_hold: values.insuranceHold,
    // Only a held insurance has a bucket (the server clears it when the hold is off).
    release_bucket_id:
      values.insuranceHold && values.releaseBucketId !== null ? Number(values.releaseBucketId) : null,
    audit_required: values.auditRequired,
    claim_format: values.claimFormat,
    payment_sla_days: values.slaDays === '' ? null : Number(values.slaDays),
    portal_url: orNull(values.portalUrl),
    ...(values.portalUser === '' ? {} : { portal_user: values.portalUser }),
    ...(values.portalPassword === '' ? {} : { portal_password: values.portalPassword }),
    is_active: values.isActive,
  }
}

/** A new insurance: with its practice. */
export function toInsurancePayload(values: InsuranceFormValues): InsurancePayload {
  // The schema has refused a missing practice before this runs.
  return { practice_id: Number(values.practiceId), ...toInsuranceUpdatePayload(values) }
}

import { z } from 'zod'
import { ICD_VERSIONS } from '../model/rules'

/**
 * An insurance class as the screens see it, parsed from the wire.
 *
 * **Provisional contract.** No backend payload exists for insurance classes.
 * The fields are the prototype's (practice, code, name, the four rule defaults,
 * ICD version, active), written under the PRD V2 column names of
 * `insurance_class` (§10.3). When the real payload arrives, this file and
 * `api/` change — nothing else.
 *
 * Assumed until a contract says otherwise: a saved class comes back as its
 * payload plus a numeric `id`.
 */
export const insuranceClassResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    code: z.string(),
    name: z.string(),
    authorization_required: z.boolean(),
    injury_date_required: z.boolean(),
    apply_specialty_modifiers: z.boolean(),
    accept_assignment: z.boolean(),
    // A string, not an enum: a version the frontend does not know yet must
    // not make the whole list fail to load.
    icd_version: z.string(),
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    code: wire.code,
    name: wire.name,
    authorizationRequired: wire.authorization_required,
    injuryDateRequired: wire.injury_date_required,
    applySpecialtyModifiers: wire.apply_specialty_modifiers,
    acceptAssignment: wire.accept_assignment,
    icdVersion: wire.icd_version,
    isActive: wire.is_active,
  }))

export type InsuranceClass = z.output<typeof insuranceClassResponseSchema>

/** The request body for create and update (provisional — see above). */
export interface InsuranceClassPayload {
  practice_id: number
  code: string
  name: string
  authorization_required: boolean
  injury_date_required: boolean
  apply_specialty_modifiers: boolean
  accept_assignment: boolean
  icd_version: string
  is_active: boolean
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const INSURANCE_CLASS_FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  practice_id: 'practiceId',
  authorization_required: 'authorizationRequired',
  injury_date_required: 'injuryDateRequired',
  apply_specialty_modifiers: 'applySpecialtyModifiers',
  accept_assignment: 'acceptAssignment',
  icd_version: 'icdVersion',
  is_active: 'isActive',
}

/**
 * What the form accepts — the prototype's checks and nothing more: practice,
 * code (at most eight characters, saved in capitals) and name are required;
 * the ICD version is one of the offered versions. Code uniqueness within a
 * practice (V2: UQ per practice) is the server's to enforce.
 */
export const insuranceClassFormSchema = z.object({
  // `: boolean` keeps TypeScript from reading the check as a type guard, so
  // the form's values stay `string | null` before and after validation.
  practiceId: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a practice.'),
  code: z.string().trim().toUpperCase().min(1, 'Enter the class code.').max(8, 'Use at most 8 characters.'),
  name: z.string().trim().min(1, 'Enter the class name.'),
  authorizationRequired: z.boolean(),
  injuryDateRequired: z.boolean(),
  applySpecialtyModifiers: z.boolean(),
  acceptAssignment: z.boolean(),
  icdVersion: z
    .string()
    .nullable()
    .refine(
      (value): boolean => value !== null && (ICD_VERSIONS as readonly string[]).includes(value),
      'Select an ICD version.',
    ),
  isActive: z.boolean(),
})

export type InsuranceClassFormValues = z.infer<typeof insuranceClassFormSchema>

/** A new class starts as the prototype's does. */
export const NEW_INSURANCE_CLASS_VALUES: Omit<InsuranceClassFormValues, 'practiceId'> = {
  code: '',
  name: '',
  authorizationRequired: false,
  injuryDateRequired: false,
  applySpecialtyModifiers: true,
  acceptAssignment: true,
  icdVersion: 'ICD10',
  isActive: true,
}

/** A saved class as the form holds it — for editing it, or changing one field of it. */
export function toInsuranceClassFormValues(insuranceClass: InsuranceClass): InsuranceClassFormValues {
  return {
    practiceId: String(insuranceClass.practiceId),
    code: insuranceClass.code,
    name: insuranceClass.name,
    authorizationRequired: insuranceClass.authorizationRequired,
    injuryDateRequired: insuranceClass.injuryDateRequired,
    applySpecialtyModifiers: insuranceClass.applySpecialtyModifiers,
    acceptAssignment: insuranceClass.acceptAssignment,
    icdVersion: insuranceClass.icdVersion,
    isActive: insuranceClass.isActive,
  }
}

export function toInsuranceClassPayload(values: InsuranceClassFormValues): InsuranceClassPayload {
  // The schema has refused a missing practice or version before this runs.
  return {
    practice_id: Number(values.practiceId),
    code: values.code,
    name: values.name,
    authorization_required: values.authorizationRequired,
    injury_date_required: values.injuryDateRequired,
    apply_specialty_modifiers: values.applySpecialtyModifiers,
    accept_assignment: values.acceptAssignment,
    icd_version: values.icdVersion ?? '',
    is_active: values.isActive,
  }
}

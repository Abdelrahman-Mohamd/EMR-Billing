import { z } from 'zod'
import { MODIFIER_SLOTS } from '../model/procedure-code'
import type { ProcedureCode, ProcedureCodePayload } from './procedure-code'

const required = (message: string) => z.string().trim().min(1, message)

/**
 * What the procedure-code form accepts — as the server does:
 * - **CPT / HCPCS:** required; five letters or digits (the server narrows it
 *   to a CPT or HCPCS shape and says so on the field). Can be changed on edit.
 * - **Description and procedure type:** required.
 * - **Default fee:** optional (the server keeps 0.00); an amount with at most
 *   two decimals.
 * - **Modifiers:** up to four, each two letters or digits; while the override
 *   is on, at least one.
 * - **Not checked:** uniqueness of the code — the server's.
 */
export const procedureCodeFormSchema = z
  .object({
    code: required('Enter the code.')
      .toUpperCase()
      .refine((value) => value === '' || /^[A-Z0-9]{5}$/.test(value), 'Please enter a valid code.'),
    description: required('Enter the description.'),
    defaultFee: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), 'Please enter a valid amount.'),
    procedureType: z
      .string()
      .nullable()
      .refine((value): boolean => value !== null, 'Select a procedure type.'),
    isTimed: z.boolean(),
    isActive: z.boolean(),
    modifierOverride: z.boolean(),
    modifiers: z
      .array(
        z
          .string()
          .trim()
          .refine((value) => value === '' || /^[A-Za-z0-9]{2}$/.test(value), 'Enter two letters or digits.'),
      )
      .length(MODIFIER_SLOTS),
  })
  .superRefine((values, context) => {
    if (values.modifierOverride && values.modifiers.every((modifier) => modifier === '')) {
      context.addIssue({
        code: 'custom',
        path: ['modifiers', 0],
        message: 'Add at least one modifier.',
      })
    }
  })

export type ProcedureCodeFormValues = z.infer<typeof procedureCodeFormSchema>

const emptySlots = () => Array.from({ length: MODIFIER_SLOTS }, () => '')

/** A new code starts as the prototype's does: Therapeutic, active, override off. */
export function newProcedureCodeValues(): ProcedureCodeFormValues {
  return {
    code: '',
    description: '',
    defaultFee: '',
    procedureType: 'therapeutic',
    isTimed: false,
    isActive: true,
    modifierOverride: false,
    modifiers: emptySlots(),
  }
}

export function toProcedureCodeFormValues(code: ProcedureCode): ProcedureCodeFormValues {
  return {
    code: code.code,
    description: code.description,
    defaultFee: code.defaultFee.toFixed(2),
    procedureType: code.procedureType === '' ? null : code.procedureType,
    isTimed: code.isTimed,
    isActive: code.isActive,
    modifierOverride: code.modifierOverride,
    modifiers: emptySlots().map((_, index) => code.modifiers[index] ?? ''),
  }
}

/** The body for create and save. As the prototype saves it: with the override off, no modifiers are kept. */
export function toProcedureCodePayload(values: ProcedureCodeFormValues): ProcedureCodePayload {
  return {
    code: values.code,
    description: values.description,
    // The schema has refused a missing type before this runs.
    procedure_type: values.procedureType ?? '',
    is_timed: values.isTimed,
    modifier_override: values.modifierOverride,
    modifiers: values.modifierOverride
      ? values.modifiers.map((modifier) => modifier.toUpperCase()).filter((modifier) => modifier !== '')
      : [],
    // Empty is no fee: 0, as the server keeps it.
    default_fee: values.defaultFee === '' ? 0 : Number(values.defaultFee),
    is_active: values.isActive,
  }
}

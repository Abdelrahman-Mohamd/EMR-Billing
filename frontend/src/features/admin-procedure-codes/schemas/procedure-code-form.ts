import { z } from 'zod'
import { MODIFIER_SLOTS, type ProcedureCode } from '../model/procedure-code'

const required = (message: string) => z.string().trim().min(1, message)

/**
 * What the procedure-code form accepts — the prototype's checks, and only
 * those:
 * - **CPT / HCPCS:** required; five letters or digits; a new code must not
 *   already be in the list ("This code exists."). Fixed once saved.
 * - **Description, default fee and procedure type:** required; the fee is an
 *   amount with at most two decimals.
 * - **Modifiers:** up to four, all optional, at most two characters each (the
 *   inputs' length). No other check — the client asked for none.
 *
 * `existingCodes` is the list to check a new code against; `null` when editing.
 */
export function procedureCodeFormSchema(existingCodes: readonly string[] | null) {
  return z.object({
    code: required('Enter the code.')
      .toUpperCase()
      .refine((value) => value === '' || /^[A-Z0-9]{5}$/.test(value), 'Please enter a valid code.')
      .refine((value) => existingCodes === null || !existingCodes.includes(value), 'This code exists.'),
    description: required('Enter the description.'),
    defaultFee: required('Enter the default fee.').refine(
      (value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value),
      'Please enter a valid amount.',
    ),
    procedureType: z
      .string()
      .nullable()
      .refine((value): boolean => value !== null, 'Select a procedure type.'),
    isTimed: z.boolean(),
    isActive: z.boolean(),
    modifierOverride: z.boolean(),
    modifiers: z.array(z.string().trim()).length(MODIFIER_SLOTS),
  })
}

export type ProcedureCodeFormValues = z.infer<ReturnType<typeof procedureCodeFormSchema>>

const emptySlots = () => Array.from({ length: MODIFIER_SLOTS }, () => '')

/** A new code starts as the prototype's does: Therapeutic, active, override off. */
export function newProcedureCodeValues(): ProcedureCodeFormValues {
  return {
    code: '',
    description: '',
    defaultFee: '',
    procedureType: 'Therapeutic',
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
    procedureType: code.procedureType,
    isTimed: code.isTimed,
    isActive: code.isActive,
    modifierOverride: code.modifierOverride,
    modifiers: emptySlots().map((_, index) => code.modifiers[index] ?? ''),
  }
}

/** The saved record. As the prototype saves it: with the override off, no modifiers are kept. */
export function toProcedureCode(values: ProcedureCodeFormValues): ProcedureCode {
  return {
    code: values.code,
    description: values.description,
    // The schema has refused a missing type before this runs.
    procedureType: values.procedureType ?? '',
    isTimed: values.isTimed,
    modifierOverride: values.modifierOverride,
    modifiers: values.modifierOverride
      ? values.modifiers.map((modifier) => modifier.toUpperCase()).filter((modifier) => modifier !== '')
      : [],
    defaultFee: Number(values.defaultFee),
    isActive: values.isActive,
    // Saving a code the EMR sent clears its "New from EMR" mark, as in the prototype.
    isNewFromEmr: false,
  }
}

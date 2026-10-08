import { z } from 'zod'
import type { FeeRow, FeeRowPayload, FeeRowUpdatePayload } from './fee-row'

/**
 * What the fee-row form accepts — as the server does: a code, the billed
 * price per unit (an amount, at most two decimals) and the start date; the
 * end date is optional (no end) and not before the start. Whether the code
 * and insurance are active, and whether the dates overlap another price of
 * the same code, are the server's to say.
 */
export const feeRowFormSchema = z
  .object({
    // `: boolean` keeps TypeScript from reading the check as a type guard, so
    // the form's values stay `string | null` before and after validation.
    procedureCodeId: z
      .string()
      .nullable()
      .refine((value): boolean => value !== null, 'Select a code.'),
    billed: z
      .string()
      .trim()
      .min(1, 'Enter the billed price.')
      .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), 'Please enter a valid amount.'),
    from: z.string().min(1, 'Enter the date it takes effect.'),
    /** ISO date; empty means no end date. */
    to: z.string(),
  })
  .refine((values) => values.from === '' || values.to === '' || values.to >= values.from, {
    path: ['to'],
    message: 'Please enter a valid date.',
  })

export type FeeRowFormValues = z.infer<typeof feeRowFormSchema>

/** A new row runs for the current year, as the prototype's does for its year. */
export function newFeeRowValues(year: number = new Date().getFullYear()): FeeRowFormValues {
  return { procedureCodeId: null, billed: '', from: `${year}-01-01`, to: `${year}-12-31` }
}

export function toFeeRowFormValues(row: FeeRow): FeeRowFormValues {
  return {
    procedureCodeId: String(row.procedureCodeId),
    billed: row.billed.toFixed(2),
    from: row.from,
    to: row.to ?? '',
  }
}

/** A save: the price and the dates — the insurance and the code never change. */
export function toFeeRowUpdatePayload(values: FeeRowFormValues): FeeRowUpdatePayload {
  return {
    billed_amount: Number(values.billed),
    effective_from: values.from,
    effective_to: values.to === '' ? null : values.to,
  }
}

/** A new row: for this insurance and the chosen code. */
export function toFeeRowPayload(insuranceId: number, values: FeeRowFormValues): FeeRowPayload {
  // The schema has refused a missing code before this runs.
  return {
    insurance_id: insuranceId,
    procedure_code_id: Number(values.procedureCodeId),
    ...toFeeRowUpdatePayload(values),
  }
}

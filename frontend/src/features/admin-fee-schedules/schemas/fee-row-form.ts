import { z } from 'zod'
import type { FeeRow } from '../model/fee-row'

/**
 * What the fee-row form accepts — the prototype's checks, and only those:
 * a code (one the insurance has no row for yet — the picker offers only
 * those), the billed price per unit (an amount, at most two decimals), and
 * both effective dates, the end not before the start.
 */
export const feeRowFormSchema = z
  .object({
    procedureCode: z
      .string()
      .nullable()
      .refine((value): boolean => value !== null, 'Select a code.'),
    billed: z
      .string()
      .trim()
      .min(1, 'Enter the billed price.')
      .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), 'Please enter a valid amount.'),
    from: z.string().min(1, 'Enter the date it takes effect.'),
    to: z.string().min(1, 'Enter the date it ends.'),
  })
  .refine((values) => values.from === '' || values.to === '' || values.to >= values.from, {
    path: ['to'],
    message: 'Please enter a valid date.',
  })

export type FeeRowFormValues = z.infer<typeof feeRowFormSchema>

/** A new row runs for the current year, as the prototype's does for its year. */
export function newFeeRowValues(year: number = new Date().getFullYear()): FeeRowFormValues {
  return { procedureCode: null, billed: '', from: `${year}-01-01`, to: `${year}-12-31` }
}

export function toFeeRowFormValues(row: FeeRow): FeeRowFormValues {
  return { procedureCode: row.procedureCode, billed: row.billed.toFixed(2), from: row.from, to: row.to }
}

export function toFeeRow(insuranceId: number, values: FeeRowFormValues): FeeRow {
  // The schema has refused a missing code before this runs.
  return {
    insuranceId,
    procedureCode: values.procedureCode ?? '',
    billed: Number(values.billed),
    from: values.from,
    to: values.to,
  }
}

import { describe, expect, it } from 'vitest'
import { feeRowFormSchema, newFeeRowValues, toFeeRow, toFeeRowFormValues } from './fee-row-form'

const errorsOf = (values: unknown) => {
  const result = feeRowFormSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

describe('fee row form — the prototype’s checks', () => {
  it('starts a new row on the current year', () => {
    expect(newFeeRowValues(2027)).toEqual({
      procedureCode: null,
      billed: '',
      from: '2027-01-01',
      to: '2027-12-31',
    })
  })

  it('requires a code, the billed price and both dates', () => {
    expect(errorsOf({ procedureCode: null, billed: '', from: '', to: '' })).toEqual({
      procedureCode: 'Select a code.',
      billed: 'Enter the billed price.',
      from: 'Enter the date it takes effect.',
      to: 'Enter the date it ends.',
    })
  })

  it('takes an amount, and an end date not before the start', () => {
    const valid = { procedureCode: '97110', billed: '30', from: '2026-01-01', to: '2026-12-31' }
    expect(errorsOf(valid)).toEqual({})
    expect(errorsOf({ ...valid, billed: '3.456' })).toEqual({ billed: 'Please enter a valid amount.' })
    expect(errorsOf({ ...valid, to: '2025-12-31' })).toEqual({ to: 'Please enter a valid date.' })
  })

  it('maps to a row for the insurance, and back', () => {
    const row = toFeeRow(4, { procedureCode: '97110', billed: '36', from: '2026-01-01', to: '2026-12-31' })
    expect(row).toEqual({
      insuranceId: 4,
      procedureCode: '97110',
      billed: 36,
      from: '2026-01-01',
      to: '2026-12-31',
    })
    expect(toFeeRowFormValues(row).billed).toBe('36.00')
  })
})

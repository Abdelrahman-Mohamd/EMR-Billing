import { describe, expect, it } from 'vitest'
import { feeRowResponseSchema } from './fee-row'
import {
  feeRowFormSchema,
  newFeeRowValues,
  toFeeRowFormValues,
  toFeeRowPayload,
  toFeeRowUpdatePayload,
} from './fee-row-form'

const errorsOf = (values: unknown) => {
  const result = feeRowFormSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}
const valid = { procedureCodeId: '1', billed: '30', from: '2026-01-01', to: '' }

describe('fee row form — the server’s checks', () => {
  it('starts a new row on the current year', () => {
    expect(newFeeRowValues(2027)).toEqual({
      procedureCodeId: null,
      billed: '',
      from: '2027-01-01',
      to: '2027-12-31',
    })
  })

  it('requires a code, the billed price and the start — not the end', () => {
    expect(errorsOf({ procedureCodeId: null, billed: '', from: '', to: '' })).toEqual({
      procedureCodeId: 'Select a code.',
      billed: 'Enter the billed price.',
      from: 'Enter the date it takes effect.',
    })
    expect(errorsOf(valid)).toEqual({})
  })

  it('takes an amount, and an end date not before the start', () => {
    expect(errorsOf({ ...valid, billed: '3.456' })).toEqual({ billed: 'Please enter a valid amount.' })
    expect(errorsOf({ ...valid, to: '2025-12-31' })).toEqual({ to: 'Please enter a valid date.' })
  })
})

describe('fee row payload (contract confirmed 2026-10-08)', () => {
  it('creates with the insurance and code; no end date is null', () => {
    expect(toFeeRowPayload(1, valid)).toEqual({
      insurance_id: 1,
      procedure_code_id: 1,
      billed_amount: 30,
      effective_from: '2026-01-01',
      effective_to: null,
    })
  })

  it('saves the price and dates only — never the insurance or the code', () => {
    expect(toFeeRowUpdatePayload({ ...valid, billed: '33.5', to: '2026-12-31' })).toEqual({
      billed_amount: 33.5,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
    })
  })

  it('reads the server’s row — amounts as strings, with its code — back into the form', () => {
    const row = feeRowResponseSchema.parse({
      id: 1,
      insurance_id: 1,
      procedure_code_id: 1,
      billed_amount: '30.00',
      effective_from: '2026-01-01',
      effective_to: null,
      insurance: { id: 1, code: 1039, name: 'Corvel Enterprise' },
      procedure_code: { id: 1, code: '98110', description: 'Therapeutic exercise', default_fee: '25.00' },
      created_at: '2026-10-08T16:43:04.000000Z',
      updated_at: '2026-10-08T16:43:04.000000Z',
    })
    expect(row).toMatchObject({ procedureCode: '98110', billed: 30, defaultFee: 25, to: null })
    expect(toFeeRowFormValues(row)).toEqual({ ...valid, billed: '30.00' })
  })
})

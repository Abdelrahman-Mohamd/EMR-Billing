import { describe, expect, it } from 'vitest'
import { lookUpPrice, type PricedRow } from './fee-row'

const rows: PricedRow[] = [
  { insuranceId: 1, procedureCodeId: 7, billed: 30, from: '2026-01-01', to: '2026-12-31' },
  { insuranceId: 2, procedureCodeId: 7, billed: 40, from: '2026-01-01', to: '2026-06-30' },
  { insuranceId: 2, procedureCodeId: 7, billed: 45, from: '2027-01-01', to: null },
]
const base = { rows, procedureCodeId: 7, defaultFee: 35, units: 2 }

describe('price lookup — the prototype’s rule', () => {
  it('uses the payer’s billed price while its row is in effect', () => {
    expect(lookUpPrice({ ...base, insuranceId: 1, date: '2026-10-01' })).toEqual({
      rate: 30,
      amount: 60,
      source: 'payer',
    })
    // From and to are inclusive.
    expect(lookUpPrice({ ...base, insuranceId: 2, date: '2026-06-30' }).source).toBe('payer')
  })

  it('runs a row with no end date on', () => {
    expect(lookUpPrice({ ...base, insuranceId: 2, date: '2031-05-01' })).toMatchObject({ rate: 45 })
  })

  it('falls back to the code’s default fee otherwise', () => {
    expect(lookUpPrice({ ...base, insuranceId: 2, date: '2026-07-01' })).toEqual({
      rate: 35,
      amount: 70,
      source: 'default',
    })
    expect(lookUpPrice({ ...base, insuranceId: 3, date: '2026-10-01' }).source).toBe('default')
  })

  it('rounds the charge to cents', () => {
    expect(
      lookUpPrice({ ...base, insuranceId: 3, defaultFee: 29.64, units: 3, date: '2026-10-01' }).amount,
    ).toBe(88.92)
  })
})

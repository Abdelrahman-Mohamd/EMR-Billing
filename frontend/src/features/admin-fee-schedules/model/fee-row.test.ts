import { describe, expect, it } from 'vitest'
import { lookUpPrice, type FeeRow } from './fee-row'

const rows: FeeRow[] = [
  { insuranceId: 1, procedureCode: '97110', billed: 30, from: '2026-01-01', to: '2026-12-31' },
  { insuranceId: 2, procedureCode: '97110', billed: 40, from: '2026-01-01', to: '2026-06-30' },
]
const base = { rows, procedureCode: '97110', defaultFee: 35, units: 2 }

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

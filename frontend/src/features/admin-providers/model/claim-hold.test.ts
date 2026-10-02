import { describe, expect, it } from 'vitest'
import { holdRunning, holdScope, holdWindow, type ClaimHold } from './claim-hold'

const hold = (from: string | null, until: string | null): ClaimHold => ({
  from,
  until,
  reason: 'Pending Provider Credentialing',
  locationIds: [],
  insuranceIds: [],
})

describe('claim hold — as the prototype shows it', () => {
  it('runs from its start (if any) through its end date, inclusive', () => {
    expect(holdRunning(hold('2026-09-01', '2026-09-30'), '2026-09-01')).toBe(true)
    expect(holdRunning(hold('2026-09-01', '2026-09-30'), '2026-09-30')).toBe(true)
    expect(holdRunning(hold('2026-09-01', '2026-09-30'), '2026-08-31')).toBe(false)
    expect(holdRunning(hold('2026-09-01', '2026-09-30'), '2026-10-01')).toBe(false)
    expect(holdRunning(hold(null, '2026-09-30'), '2026-01-01')).toBe(true)
    expect(holdRunning(hold(null, null), '2026-09-15')).toBe(false)
  })

  it('reads its window and scope the way the prototype writes them', () => {
    expect(holdWindow(hold('2026-09-01', '2026-09-30'))).toBe('09/01/2026 – 09/30/2026')
    expect(holdWindow(hold(null, '2026-09-30'))).toBe('until 09/30/2026')
    expect(holdScope([], [])).toBe('every location and payer')
    expect(holdScope(['Bay Ridge'], [])).toBe('Bay Ridge · every payer')
    expect(holdScope([], ['Aetna', 'Cigna'])).toBe('every location · Aetna, Cigna')
  })
})

import { describe, expect, it } from 'vitest'
import { formatWhen } from './format-when'

// Built from local dates, so the expectations hold in any time zone.
const now = new Date(2026, 8, 30, 16, 5)
const at = (day: number, hour: number, minute: number) => new Date(2026, 8, day, hour, minute).toISOString()

describe('formatWhen — the prototype’s When cell', () => {
  it('says Today or Yesterday with the time, and the full date beneath', () => {
    expect(formatWhen(at(30, 14, 32), now)).toEqual({ label: 'Today 14:32', date: '09/30/2026' })
    expect(formatWhen(at(29, 9, 5), now)).toEqual({ label: 'Yesterday 09:05', date: '09/29/2026' })
  })

  it('names the month for anything older', () => {
    expect(formatWhen(at(12, 8, 0), now)).toEqual({ label: 'Sep 12 08:00', date: '09/12/2026' })
  })

  it('shows a timestamp it cannot read exactly as it came', () => {
    expect(formatWhen('not a date', now)).toEqual({ label: 'not a date', date: '' })
  })
})

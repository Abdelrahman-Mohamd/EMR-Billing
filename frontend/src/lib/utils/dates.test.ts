import { expect, it } from 'vitest'
import { formatIsoDate, todayIso } from './dates'

it('formats dates as MM/DD/YYYY and knows today in the viewer’s calendar', () => {
  expect(formatIsoDate('2026-10-01')).toBe('10/01/2026')
  expect(todayIso(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01')
})

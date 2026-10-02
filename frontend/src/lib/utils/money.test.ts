import { expect, it } from 'vitest'
import { formatMoney } from './money'

it('shows dollars with two decimals', () => {
  expect(formatMoney(34)).toBe('$34.00')
  expect(formatMoney(1234.5)).toBe('$1,234.50')
  expect(formatMoney(0)).toBe('$0.00')
})

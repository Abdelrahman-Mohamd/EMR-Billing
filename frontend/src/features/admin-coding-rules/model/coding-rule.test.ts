import { describe, expect, it } from 'vitest'
import { ruleName, scopeFromKey, scopeKey } from './coding-rule'

describe('Applies to as one select value', () => {
  it('round-trips each scope', () => {
    for (const scope of [{ kind: 'default' as const }, { kind: 'insurance' as const, insuranceId: 12 }])
      expect(scopeFromKey(scopeKey(scope))).toEqual(scope)
  })

  it('reads nothing from a value it does not know — a class rule included', () => {
    expect(scopeFromKey('practice:1')).toBeNull()
    expect(scopeFromKey('class:3')).toBeNull()
    expect(scopeFromKey('insurance:x')).toBeNull()
  })
})

it('names a rule', () => {
  expect(ruleName({ type: 'Replace', fromCode: '97014', toCode: 'G0283' })).toBe('Replace 97014 → G0283')
  expect(ruleName({ type: 'Drop', fromCode: '97010', toCode: '' })).toBe('Drop 97010')
})

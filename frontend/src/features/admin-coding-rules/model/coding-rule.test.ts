import { describe, expect, it } from 'vitest'
import { ruleFor, ruleName, scopeFromKey, scopeKey, type CodingRule } from './coding-rule'

const rule = (overrides: Partial<CodingRule> & Pick<CodingRule, 'id' | 'scope'>): CodingRule => ({
  type: 'Drop',
  fromCode: '97014',
  toCode: '',
  note: '',
  isActive: true,
  ...overrides,
})

describe('Applies to as one select value', () => {
  it('round-trips each scope', () => {
    for (const scope of [
      { kind: 'default' as const },
      { kind: 'class' as const, classId: 3 },
      { kind: 'insurance' as const, insuranceId: 12 },
    ])
      expect(scopeFromKey(scopeKey(scope))).toEqual(scope)
  })

  it('reads nothing from a value it does not know', () => {
    expect(scopeFromKey('practice:1')).toBeNull()
    expect(scopeFromKey('class:x')).toBeNull()
  })
})

describe('which rule acts — the prototype’s precedence', () => {
  const medicare = { id: 1, insuranceClassId: 7 }
  const rules = [
    rule({ id: 'default', scope: { kind: 'default' } }),
    rule({ id: 'class', scope: { kind: 'class', classId: 7 } }),
    rule({ id: 'payer', scope: { kind: 'insurance', insuranceId: 1 } }),
  ]

  it('takes the insurance’s own rule first, then its class’s, then the default', () => {
    expect(ruleFor(rules, '97014', medicare)?.id).toBe('payer')
    expect(ruleFor(rules.slice(0, 2), '97014', medicare)?.id).toBe('class')
    expect(ruleFor(rules.slice(0, 1), '97014', medicare)?.id).toBe('default')
    expect(ruleFor(rules, '97014', { id: 2, insuranceClassId: 8 })?.id).toBe('default')
  })

  it('ignores inactive rules and other codes', () => {
    expect(ruleFor([{ ...rules[2]!, isActive: false }, rules[0]!], '97014', medicare)?.id).toBe('default')
    expect(ruleFor(rules, '97010', medicare)).toBeUndefined()
  })
})

it('names a rule', () => {
  expect(ruleName({ type: 'Replace', fromCode: '97014', toCode: 'G0283' })).toBe('Replace 97014 → G0283')
  expect(ruleName({ type: 'Drop', fromCode: '97010', toCode: '' })).toBe('Drop 97010')
})

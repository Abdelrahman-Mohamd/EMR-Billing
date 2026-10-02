import { describe, expect, it } from 'vitest'
import { codingRuleFormSchema, newCodingRuleValues, toCodingRuleValues } from './coding-rule-form'

const messages = (values: unknown) => {
  const result = codingRuleFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('the coding-rule form', () => {
  it('asks for the code and, for Replace, its replacement — all at once', () => {
    expect(messages(newCodingRuleValues())).toEqual([
      'fromCode: Select a code.',
      'toCode: Select the code to replace it with.',
    ])
  })

  it('refuses replacing a code with itself', () => {
    expect(messages({ ...newCodingRuleValues(), fromCode: '97014', toCode: '97014' })).toEqual([
      'toCode: Please choose a different code.',
    ])
  })

  it('needs no replacement for a Drop rule, and keeps none', () => {
    const values = { ...newCodingRuleValues(), type: 'Drop' as const, fromCode: '97010', toCode: 'G0283' }
    expect(messages(values)).toEqual([])
    expect(toCodingRuleValues(codingRuleFormSchema.parse(values))).toEqual({
      type: 'Drop',
      fromCode: '97010',
      toCode: '',
      scope: { kind: 'default' },
      note: '',
    })
  })

  it('asks what the rule applies to', () => {
    expect(messages({ ...newCodingRuleValues(), type: 'Drop', fromCode: '97010', scope: '' })).toEqual([
      'scope: Select what the rule applies to.',
    ])
  })

  it('reads the scope it was given', () => {
    const parsed = codingRuleFormSchema.parse({
      type: 'Replace',
      fromCode: '97014',
      toCode: 'G0283',
      scope: 'insurance:1',
      note: ' Medicare ',
    })
    expect(toCodingRuleValues(parsed)).toEqual({
      type: 'Replace',
      fromCode: '97014',
      toCode: 'G0283',
      scope: { kind: 'insurance', insuranceId: 1 },
      note: 'Medicare',
    })
  })
})

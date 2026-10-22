import { describe, expect, it } from 'vitest'
import {
  codingRuleFormSchema,
  newCodingRuleValues,
  toCodingRuleFormValues,
  toCodingRulePayload,
} from './coding-rule-form'

const messages = (values: unknown) => {
  const result = codingRuleFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('the coding-rule form', () => {
  it('asks for the code and, for Replace, its replacement — all at once', () => {
    expect(messages(newCodingRuleValues())).toEqual([
      'fromCode: Select a code.',
      'toCode: Select the code to replace it with.',
      'scope: Select the insurance it applies to.',
    ])
  })

  it('refuses replacing a code with itself', () => {
    expect(
      messages({ ...newCodingRuleValues(), fromCode: '14', toCode: '14', scope: 'insurance:1' }),
    ).toEqual(['toCode: Please choose a different code.'])
  })

  it('needs no replacement for a Drop rule, and sends none', () => {
    const values = {
      ...newCodingRuleValues(),
      type: 'Drop' as const,
      fromCode: '3',
      toCode: '1',
      scope: 'insurance:4',
    }
    expect(messages(values)).toEqual([])
    expect(toCodingRulePayload(codingRuleFormSchema.parse(values))).toEqual({
      action: 'drop',
      procedure_code_id: 3,
      replacement_code_id: null,
      insurance_id: 4,
      notes: null,
    })
  })

  it('asks for the insurance — a rule is always one insurance’s — and keeps the note to 1000 characters', () => {
    expect(
      messages({ ...newCodingRuleValues(), type: 'Drop', fromCode: '3', scope: '', note: 'x'.repeat(1001) }),
    ).toEqual(['note: Use at most 1000 characters.', 'scope: Select the insurance it applies to.'])
    // No new default rule (the server refuses one since 2026-10-22).
    expect(messages({ ...newCodingRuleValues(), type: 'Drop', fromCode: '3', scope: 'default' })).toEqual([
      'scope: Select the insurance it applies to.',
    ])
  })

  it('sends a payer’s Replace rule as the server takes it', () => {
    const parsed = codingRuleFormSchema.parse({
      type: 'Replace',
      fromCode: '14',
      toCode: '1',
      scope: 'insurance:1',
      note: ' Medicare ',
    })
    expect(toCodingRulePayload(parsed)).toEqual({
      action: 'replace',
      procedure_code_id: 14,
      replacement_code_id: 1,
      insurance_id: 1,
      notes: 'Medicare',
    })
  })

  it('reads a saved rule back into the form by its codes’ ids', () => {
    expect(
      toCodingRuleFormValues({
        id: 6,
        practiceId: 1,
        type: 'Replace',
        fromCodeId: 14,
        fromCode: '97014',
        toCodeId: 1,
        toCode: '98110',
        scope: { kind: 'insurance', insuranceId: 1 },
        insuranceName: 'Corvel Enterprise',
        note: 'Payer contract',
        isActive: true,
      }),
    ).toEqual({ type: 'Replace', fromCode: '14', toCode: '1', scope: 'insurance:1', note: 'Payer contract' })
  })
})

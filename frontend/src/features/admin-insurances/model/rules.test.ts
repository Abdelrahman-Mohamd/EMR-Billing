import { describe, expect, it } from 'vitest'
import { effectiveRules, hasOverrides, insuranceLabel, type ClassRules, type RuleOverrides } from './rules'

const classRules: ClassRules = {
  authorizationRequired: true,
  injuryDateRequired: false,
  applySpecialtyModifiers: true,
  acceptAssignment: true,
  icdVersion: 'ICD10',
}
const inheritAll: RuleOverrides = {
  authorizationRequired: null,
  injuryDateRequired: null,
  applySpecialtyModifiers: null,
  acceptAssignment: null,
  icdVersion: null,
}

describe('effectiveRules — COALESCE(insurance, class), PRD V2 §10.3', () => {
  it('takes every value from the class when the insurance overrides nothing', () => {
    expect(effectiveRules(classRules, inheritAll)).toEqual([
      { key: 'authorizationRequired', label: 'Authorization required', value: 'Yes', source: 'class' },
      { key: 'injuryDateRequired', label: 'Injury date required', value: 'No', source: 'class' },
      { key: 'applySpecialtyModifiers', label: 'Apply specialty modifiers', value: 'Yes', source: 'class' },
      { key: 'acceptAssignment', label: 'Accept assignment', value: 'Yes', source: 'class' },
      { key: 'icdVersion', label: 'ICD version', value: 'ICD10', source: 'class' },
    ])
    expect(hasOverrides(inheritAll)).toBe(false)
  })

  it('uses the insurance’s own value where it sets one, including false', () => {
    const overrides = { ...inheritAll, authorizationRequired: false, icdVersion: 'ICD9' }
    const rules = effectiveRules(classRules, overrides)
    expect(rules[0]).toMatchObject({ value: 'No', source: 'override' })
    expect(rules[4]).toMatchObject({ value: 'ICD9', source: 'override' })
    expect(rules[1]).toMatchObject({ source: 'class' })
    expect(hasOverrides(overrides)).toBe(true)
  })
})

it('labels an insurance by code and name, as the prototype does', () => {
  expect(insuranceLabel({ code: 1001, name: 'Medicare Part B' })).toBe('1001 – Medicare Part B')
})

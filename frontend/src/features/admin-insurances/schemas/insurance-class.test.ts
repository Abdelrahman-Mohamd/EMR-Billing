import { describe, expect, it } from 'vitest'
import {
  insuranceClassFormSchema,
  NEW_INSURANCE_CLASS_VALUES,
  toInsuranceClassPayload,
  type InsuranceClassFormValues,
} from './insurance-class'

const filled: InsuranceClassFormValues = {
  ...NEW_INSURANCE_CLASS_VALUES,
  practiceId: '2',
  code: 'wc',
  name: 'Worker’s Comp',
}

describe('insurance class payload (provisional — prototype fields, PRD V2 names)', () => {
  it('sends the form as the snake_case body, the code in capitals', () => {
    const values = insuranceClassFormSchema.parse({ ...filled, authorizationRequired: true })
    expect(toInsuranceClassPayload(values)).toEqual({
      practice_id: 2,
      code: 'WC',
      name: 'Worker’s Comp',
      authorization_required: true,
      injury_date_required: false,
      apply_specialty_modifiers: true,
      accept_assignment: true,
      icd_version: 'ICD10',
      is_active: true,
    })
  })

  it('requires practice, code (at most 8 characters) and name', () => {
    const result = insuranceClassFormSchema.safeParse({ ...NEW_INSURANCE_CLASS_VALUES, practiceId: null })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Select a practice.',
      'Enter the class code.',
      'Enter the class name.',
    ])
    expect(
      insuranceClassFormSchema.safeParse({ ...filled, code: 'TOOLONGCODE' }).error?.issues[0]?.message,
    ).toBe('Use at most 8 characters.')
  })
})

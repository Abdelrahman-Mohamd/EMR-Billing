import { describe, expect, it } from 'vitest'
import {
  insuranceFormSchema,
  insuranceResponseSchema,
  NEW_INSURANCE_VALUES,
  toInsuranceFormValues,
  toInsurancePayload,
  type InsuranceFormValues,
} from './insurance'

const filled: InsuranceFormValues = {
  ...NEW_INSURANCE_VALUES,
  practiceId: '1',
  code: '1060',
  name: 'Oscar Health',
  insuranceClassId: '3',
  insuranceType: 'Commercial',
  payerId: 'OSCAR',
}

const errorsOf = (values: InsuranceFormValues) => {
  const result = insuranceFormSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

describe('insurance payload (provisional — prototype fields, PRD V2 names)', () => {
  it('sends the form as the snake_case body, inherit as null and empty optional text as null', () => {
    expect(toInsurancePayload(filled)).toEqual({
      practice_id: 1,
      insurance_class_id: 3,
      code: 1060,
      name: 'Oscar Health',
      insurance_type: 'Commercial',
      payer_id: 'OSCAR',
      address: { line1: '', city: '', state: '', zip: '' },
      phone: null,
      fax: null,
      authorization_required: null,
      injury_date_required: null,
      apply_specialty_modifiers: null,
      accept_assignment: null,
      icd_version: null,
      insurance_hold: false,
      release_bucket_id: null,
      audit_required: false,
      claim_format: '837P',
      max_units: 6,
      sla_days: 30,
      portal_url: null,
      is_active: true,
    })
  })

  it('sends overrides, the audit flag, the portal link and — only while held — the bucket', () => {
    const payload = toInsurancePayload({
      ...filled,
      authorizationRequired: 'no',
      applySpecialtyModifiers: 'yes',
      icdVersion: 'ICD9',
      auditRequired: true,
      portalUrl: 'https://portal.example-payer.com',
      insuranceHold: true,
      releaseBucketId: '2',
    })
    expect(payload).toMatchObject({
      authorization_required: false,
      apply_specialty_modifiers: true,
      injury_date_required: null,
      icd_version: 'ICD9',
      audit_required: true,
      portal_url: 'https://portal.example-payer.com',
      insurance_hold: true,
      release_bucket_id: 2,
    })
    expect(
      toInsurancePayload({ ...filled, insuranceHold: false, releaseBucketId: '2' }).release_bucket_id,
    ).toBeNull()
  })

  it('never carries a portal user or password', () => {
    const keys = Object.keys(toInsurancePayload(filled))
    expect(keys.filter((key) => key.startsWith('portal'))).toEqual(['portal_url'])
  })

  it('reads a response back into the same form values', () => {
    const insurance = insuranceResponseSchema.parse({ ...toInsurancePayload(filled), id: 7 })
    expect(toInsuranceFormValues(insurance)).toEqual(filled)
  })
})

describe('insurance form checks (the prototype’s)', () => {
  it('requires the payer fields, class, type and a release bucket while held', () => {
    expect(errorsOf({ ...NEW_INSURANCE_VALUES, practiceId: null, insuranceHold: true })).toEqual({
      practiceId: 'Select a practice.',
      code: 'Enter the insurance code.',
      name: 'Enter the insurance name.',
      insuranceClassId: 'Select an insurance class.',
      insuranceType: 'Select an insurance type.',
      payerId: 'Enter the payer ID.',
      releaseBucketId: 'Select a release bucket.',
    })
  })

  it('checks formats only when an optional field is filled', () => {
    expect(errorsOf(filled)).toEqual({})
    expect(
      errorsOf({
        ...filled,
        code: '10A',
        address: { line1: '', city: '', state: 'N', zip: '123' },
        phone: '8005550100',
        maxUnits: '21',
        slaDays: '0',
      }),
    ).toEqual({
      code: 'Enter the code as a whole number.',
      'address.state': 'Please enter a valid state.',
      'address.zip': 'Please enter a valid ZIP code.',
      phone: 'Enter the phone number as 000-000-0000.',
      maxUnits: 'Enter a number from 1 to 20.',
      slaDays: 'Enter a number of days from 1 to 365.',
    })
  })

  it('accepts any payer portal link — the client gave no rule for it', () => {
    expect(errorsOf({ ...filled, portalUrl: 'portal.example-payer.com/login' })).toEqual({})
  })
})

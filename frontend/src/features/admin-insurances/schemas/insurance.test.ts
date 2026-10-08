import { describe, expect, it } from 'vitest'
import {
  insuranceDetailResponseSchema,
  insuranceFormSchema,
  insuranceResponseSchema,
  NEW_INSURANCE_VALUES,
  toInsuranceFormValues,
  toInsurancePayload,
  toInsuranceUpdatePayload,
  type InsuranceFormValues,
} from './insurance'

const filled: InsuranceFormValues = {
  ...NEW_INSURANCE_VALUES,
  practiceId: '3',
  code: '1039',
  name: 'Corvel Enterprise',
  insuranceClassId: '5',
  insuranceType: 'WC',
  payerId: 'CORVEL',
}

const errorsOf = (values: InsuranceFormValues) => {
  const result = insuranceFormSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

describe('insurance payload (confirmed 2026-10-08)', () => {
  it('builds the example payload: a flat address, the rules, the hold and its bucket, the portal sign-in', () => {
    expect(
      toInsurancePayload({
        ...filled,
        address: { line1: 'PO Box 2626', line2: '', city: 'Portland', state: 'OR', zip: '97208' },
        phone: '(800) 555-0199',
        acceptAssignment: 'no',
        insuranceHold: true,
        releaseBucketId: '5',
        portalUrl: 'https://portal.corvel.com',
        portalUser: 'billing@clinic',
        portalPassword: 'secret',
      }),
    ).toEqual({
      practice_id: 3,
      insurance_class_id: 5,
      code: 1039,
      name: 'Corvel Enterprise',
      insurance_type: 'WC',
      payer_id: 'CORVEL',
      address: 'PO Box 2626',
      address_line2: null,
      city: 'Portland',
      state: 'OR',
      zip_code: '97208',
      phone: '(800) 555-0199',
      fax: null,
      authorization_required: null,
      injury_date_required: null,
      apply_specialty_modifiers: null,
      accept_assignment: false,
      icd_version: null,
      insurance_hold: true,
      release_bucket_id: 5,
      audit_required: false,
      claim_format: '837P',
      payment_sla_days: null,
      portal_url: 'https://portal.corvel.com',
      portal_user: 'billing@clinic',
      portal_password: 'secret',
      is_active: true,
    })
  })

  it('starts at the server default claim format, and leaves out an empty portal sign-in', () => {
    const payload = toInsurancePayload(filled)
    expect(payload.claim_format).toBe('837P')
    expect(payload).not.toHaveProperty('portal_user')
    expect(payload).not.toHaveProperty('portal_password')
    expect(toInsurancePayload({ ...filled, claimFormat: 'CMS1500', slaDays: '45' })).toEqual(
      expect.objectContaining({ claim_format: 'CMS1500', payment_sla_days: 45 }),
    )
  })

  it('sends the bucket only while held', () => {
    expect(
      toInsurancePayload({ ...filled, insuranceHold: false, releaseBucketId: '2' }).release_bucket_id,
    ).toBeNull()
  })

  it('saves without practice_id, which the server refuses on a save', () => {
    expect(toInsuranceUpdatePayload(filled)).not.toHaveProperty('practice_id')
  })
})

describe('insurance responses', () => {
  it('reads a list item, its class and bucket from their records, its type with the server label', () => {
    expect(
      insuranceResponseSchema.parse({
        id: 1,
        practice_id: 1,
        code: 1039,
        name: 'Corvel Enterprise',
        display_name: '1039 – Corvel Enterprise',
        insurance_type: 'WC',
        insurance_type_label: "Workers' Comp",
        payer_id: 'CORVEL',
        insurance_hold: true,
        authorization_required: null,
        injury_date_required: null,
        apply_specialty_modifiers: null,
        accept_assignment: false,
        audit_required: false,
        is_active: true,
        insurance_class: { id: 1, name: "Worker's Comp" },
        release_bucket: { id: 1, name: 'Manual Release – WC Payers' },
        created_at: '2026-10-08T13:01:21.000000Z',
      }),
    ).toEqual({
      id: 1,
      practiceId: 1,
      insuranceClassId: 1,
      insuranceClassName: "Worker's Comp",
      code: 1039,
      name: 'Corvel Enterprise',
      insuranceType: 'WC',
      insuranceTypeLabel: "Workers' Comp",
      payerId: 'CORVEL',
      insuranceHold: true,
      releaseBucketId: 1,
      releaseBucketName: 'Manual Release – WC Payers',
      rules: {
        authorizationRequired: null,
        injuryDateRequired: null,
        applySpecialtyModifiers: null,
        acceptAssignment: false,
      },
      auditRequired: false,
      isActive: true,
    })
  })

  it('reads the full record into the edit form: the phone readable, the portal sign-in empty', () => {
    const detail = insuranceDetailResponseSchema.parse({
      data: {
        id: 1,
        practice_id: 3,
        insurance_class_id: 5,
        code: 1039,
        name: 'Corvel Enterprise',
        insurance_type: 'WC',
        payer_id: 'CORVEL',
        claim_format: '837P',
        payment_sla_days: null,
        address: 'PO Box 2626',
        address_line2: null,
        city: 'Portland',
        state: 'OR',
        zip_code: '97208',
        phone: '8005550199',
        fax: null,
        authorization_required: null,
        injury_date_required: null,
        apply_specialty_modifiers: null,
        accept_assignment: false,
        icd_version: null,
        effective_rules: { authorization_required: true },
        insurance_hold: true,
        audit_required: false,
        release_bucket_id: 5,
        portal_url: 'https://portal.corvel.com',
        is_active: true,
      },
    })
    expect(toInsuranceFormValues(detail)).toEqual({
      ...filled,
      address: { line1: 'PO Box 2626', line2: '', city: 'Portland', state: 'OR', zip: '97208' },
      phone: '800-555-0199',
      acceptAssignment: 'no',
      insuranceHold: true,
      releaseBucketId: '5',
      claimFormat: '837P',
      portalUrl: 'https://portal.corvel.com',
    })
  })
})

describe('insurance form checks', () => {
  it('requires the payer fields, class, type and a release bucket while held', () => {
    expect(errorsOf({ ...NEW_INSURANCE_VALUES, practiceId: null, insuranceHold: true })).toEqual({
      practiceId: 'Select a practice.',
      code: 'Enter the insurance code.',
      name: 'Enter the insurance name.',
      insuranceClassId: 'Select an insurance class.',
      insuranceType: 'Select an insurance type.',
      releaseBucketId: 'Select a release bucket.',
    })
  })

  it('checks formats only when an optional field is filled — phone and fax as 10 digits, as the server does', () => {
    expect(errorsOf(filled)).toEqual({})
    expect(errorsOf({ ...filled, phone: '(800) 555-0199', fax: '800 555 0100' })).toEqual({})
    expect(
      errorsOf({
        ...filled,
        code: '10A',
        address: { line1: '', line2: '', city: '', state: 'N', zip: '123' },
        phone: '555-0199',
        fax: '+1 800 555 0199',
        slaDays: '0',
      }),
    ).toEqual({
      code: 'Enter the code as a whole number.',
      'address.state': 'Please enter a valid state.',
      'address.zip': 'Please enter a valid ZIP code.',
      phone: 'Enter a 10-digit phone number.',
      fax: 'Enter a 10-digit fax number.',
      slaDays: 'Enter a number of days from 1 to 365.',
    })
  })
})

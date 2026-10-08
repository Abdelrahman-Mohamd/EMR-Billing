import { describe, expect, it } from 'vitest'
import {
  referringPhysicianFormSchema,
  referringPhysicianResponseSchema,
  toReferringPhysicianFormValues,
  toReferringPhysicianPayload,
  toReferringPhysicianUpdatePayload,
} from './referring-physician'

const valid = {
  practiceId: '1',
  code: '3VY',
  name: 'Demetrios Mikelis',
  type: 'DN',
  npi: '1447694153',
  phone: '',
  fax: '',
  isActive: true,
}

describe('referring physician payload (confirmed 2026-10-08)', () => {
  it('creates with the example fields, plus phone, fax and is_active', () => {
    expect(toReferringPhysicianPayload(valid)).toStrictEqual({
      practice_id: 1,
      code: '3VY',
      name: 'Demetrios Mikelis',
      type: 'DN',
      npi: '1447694153',
      phone: null,
      fax: null,
      is_active: true,
    })
  })

  it('sends phone and fax as the ten digits the server takes', () => {
    expect(
      toReferringPhysicianPayload({ ...valid, phone: '(800) 555-0199', fax: '800 555 0100' }),
    ).toMatchObject({
      phone: '8005550199',
      fax: '8005550100',
    })
  })

  it('saves without practice_id, which the server refuses on a save', () => {
    expect(toReferringPhysicianUpdatePayload(valid)).not.toHaveProperty('practice_id')
  })
})

describe('referring physician response', () => {
  it('reads the type label, phone, fax and status, and shows the phone readably on the form', () => {
    const physician = referringPhysicianResponseSchema.parse({
      id: 1,
      practice_id: 1,
      code: '3VY',
      name: 'Demetrios Mikelis',
      type: 'DN',
      type_label: 'Referring',
      npi: '1447694153',
      phone: '8005550199',
      fax: null,
      is_active: true,
      practice: { id: 1 },
      created_at: '2026-10-08T14:14:20.000000Z',
    })
    expect(physician).toEqual({
      id: 1,
      practiceId: 1,
      code: '3VY',
      name: 'Demetrios Mikelis',
      type: 'DN',
      typeLabel: 'Referring',
      npi: '1447694153',
      phone: '8005550199',
      fax: '',
      isActive: true,
    })
    expect(toReferringPhysicianFormValues(physician)).toMatchObject({ phone: '800-555-0199', fax: '' })
  })
})

describe('referring physician form', () => {
  it('requires practice, code, name, type and NPI', () => {
    const result = referringPhysicianFormSchema.safeParse({
      ...valid,
      practiceId: null,
      code: ' ',
      name: '',
      type: null,
      npi: '',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Select a practice.',
        'Enter the code.',
        'Enter the physician name.',
        'Select a type.',
        'Enter the NPI.',
      ]),
    )
  })

  it('accepts a ten-digit NPI and refuses other formats and the dummy NPIs', () => {
    expect(referringPhysicianFormSchema.safeParse(valid).success).toBe(true)
    for (const npi of ['12345', '12345678901', 'abcdefghij', '9999999999', '1234567890']) {
      expect(referringPhysicianFormSchema.safeParse({ ...valid, npi }).success).toBe(false)
    }
  })

  it('takes phone and fax with or without punctuation, as ten digits', () => {
    expect(referringPhysicianFormSchema.safeParse({ ...valid, phone: '(800) 555-0199' }).success).toBe(true)
    expect(referringPhysicianFormSchema.safeParse({ ...valid, phone: '555-0199' }).success).toBe(false)
  })
})

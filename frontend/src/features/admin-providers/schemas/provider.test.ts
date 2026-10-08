import { describe, expect, it } from 'vitest'
import {
  NEW_PROVIDER_VALUES,
  providerFormSchema,
  providerResponseSchema,
  toProviderFormValues,
  toProviderPayload,
  toProviderUpdatePayload,
  type ProviderFormValues,
} from './provider'

const filled: ProviderFormValues = {
  ...NEW_PROVIDER_VALUES,
  practiceId: '1',
  firstName: 'Mina',
  lastName: 'Shehata',
  credential: 'PT',
  code: '297',
  npi: '1234567893',
  stateLicense: 'NY123456',
}

const errorsOf = (values: ProviderFormValues) => {
  const result = providerFormSchema.safeParse(values)
  return result.success
    ? {}
    : // The first message of each field, as the form shows it.
      Object.fromEntries(result.error.issues.reverse().map((issue) => [issue.path.join('.'), issue.message]))
}

describe('provider payload (contract confirmed 2026-10-08)', () => {
  it('creates with the confirmed body, the type and status added', () => {
    expect(toProviderPayload(filled)).toEqual({
      practice_id: 1,
      code: '297',
      first_name: 'Mina',
      last_name: 'Shehata',
      type: 'rendering',
      credential: 'PT',
      specialty: 'PHYSICAL THERAPIST',
      npi: '1234567893',
      taxonomy_code: '225100000X',
      state_license: 'NY123456',
      is_active: true,
    })
  })

  it('saves without the practice, and sends a cleared optional field as null', () => {
    const save = toProviderUpdatePayload({
      ...filled,
      credential: '',
      specialty: null,
      taxonomyCode: '',
      stateLicense: '',
    })
    expect(save).not.toHaveProperty('practice_id')
    expect(save).toMatchObject({
      credential: null,
      specialty: null,
      taxonomy_code: null,
      state_license: null,
    })
  })

  it('carries no claim hold, payer enrollment or credentialing field', () => {
    expect(
      Object.keys(toProviderPayload(filled)).filter((key) => /hold|enrol|credentialing/i.test(key)),
    ).toEqual([])
  })

  it('reads the server’s provider — nulls as empty, the practice’s name — back into the form', () => {
    const provider = providerResponseSchema.parse({
      id: 1,
      practice_id: 1,
      code: '297',
      first_name: 'Mina',
      last_name: 'Shehata',
      type: 'rendering',
      type_label: 'Rendering',
      credential: null,
      specialty: null,
      npi: '1234567893',
      taxonomy_code: null,
      state_license: null,
      is_active: true,
      practice: { id: 1, name: 'Physical Therapy of The City' },
      created_at: '2026-10-08T14:35:58.000000Z',
    })
    expect(provider).toMatchObject({ practiceName: 'Physical Therapy of The City', typeLabel: 'Rendering' })
    expect(toProviderFormValues(provider)).toEqual({
      ...filled,
      credential: '',
      specialty: null,
      taxonomyCode: '',
      stateLicense: '',
    })
  })
})

describe('provider form checks (the server’s)', () => {
  it('requires the practice, names, Provider ID, type and NPI — not specialty or taxonomy', () => {
    expect(
      errorsOf({ ...NEW_PROVIDER_VALUES, practiceId: null, type: null, specialty: null, taxonomyCode: '' }),
    ).toEqual({
      practiceId: 'Select a practice.',
      firstName: 'Enter the first name.',
      lastName: 'Enter the last name.',
      code: 'Enter the Provider ID.',
      type: 'Select a provider type.',
      npi: 'Enter the NPI.',
    })
    expect(errorsOf(filled)).toEqual({})
  })

  it('refuses an NPI that is not ten digits or is a placeholder, and a malformed taxonomy code', () => {
    expect(errorsOf({ ...filled, npi: '12345' })).toEqual({ npi: 'Please enter a valid NPI.' })
    expect(errorsOf({ ...filled, npi: '9999999999' })).toEqual({ npi: 'Please enter a valid NPI.' })
    expect(errorsOf({ ...filled, taxonomyCode: 'ABC' })).toEqual({
      taxonomyCode: 'Please enter a valid taxonomy code.',
    })
  })
})

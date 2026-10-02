import { describe, expect, it } from 'vitest'
import {
  NEW_PROVIDER_VALUES,
  providerFormSchema,
  providerResponseSchema,
  toProviderFormValues,
  toProviderPayload,
  type ProviderFormValues,
} from './provider'

const filled: ProviderFormValues = {
  ...NEW_PROVIDER_VALUES,
  practiceId: '2',
  firstName: 'Priya',
  lastName: 'Raman',
  code: '340',
  providerType: 'Rendering',
  npi: '1386950417',
}

const errorsOf = (values: ProviderFormValues) => {
  const result = providerFormSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

describe('provider payload (provisional — prototype fields, PRD V2 names)', () => {
  it('sends the form as the snake_case body, empty optional text as null, no hold without an end date', () => {
    expect(toProviderPayload(filled)).toEqual({
      practice_id: 2,
      code: '340',
      first_name: 'Priya',
      last_name: 'Raman',
      credential: null,
      specialty: 'PHYSICAL THERAPIST',
      provider_type: 'Rendering',
      npi: '1386950417',
      taxonomy_code: '225100000X',
      state_license: null,
      claim_hold_from: null,
      claim_hold_until: null,
      claim_hold_reason: null,
      claim_hold_location_ids: [],
      claim_hold_insurance_ids: [],
      is_active: true,
    })
  })

  it('sends a hold with its window, reason and the ids of the locations and payers it covers', () => {
    expect(
      toProviderPayload({
        ...filled,
        claimHoldFrom: '2026-10-01',
        claimHoldUntil: '2026-10-31',
        claimHoldReason: 'Pending Provider Credentialing',
        claimHoldLocationIds: ['4'],
        claimHoldInsuranceIds: ['9', '10'],
      }),
    ).toMatchObject({
      claim_hold_from: '2026-10-01',
      claim_hold_until: '2026-10-31',
      claim_hold_reason: 'Pending Provider Credentialing',
      claim_hold_location_ids: [4],
      claim_hold_insurance_ids: [9, 10],
    })
  })

  it('drops a half-filled hold that has no end date, as the prototype does', () => {
    expect(
      toProviderPayload({
        ...filled,
        claimHoldFrom: '2026-10-01',
        claimHoldReason: 'x',
        claimHoldLocationIds: ['4'],
      }),
    ).toMatchObject({ claim_hold_from: null, claim_hold_reason: null, claim_hold_location_ids: [] })
  })

  it('carries no payer enrollment or credentialing field', () => {
    expect(Object.keys(toProviderPayload(filled)).filter((key) => /enrol|credentialing/i.test(key))).toEqual(
      [],
    )
  })

  it('reads a response back into the same form values', () => {
    expect(
      toProviderFormValues(providerResponseSchema.parse({ ...toProviderPayload(filled), id: 5 })),
    ).toEqual(filled)
  })
})

describe('provider form checks (the prototype’s)', () => {
  it('requires names, Provider ID, specialty, type, NPI and taxonomy', () => {
    expect(errorsOf({ ...NEW_PROVIDER_VALUES, practiceId: null, specialty: null, taxonomyCode: '' })).toEqual(
      {
        practiceId: 'Select a practice.',
        firstName: 'Enter the first name.',
        lastName: 'Enter the last name.',
        code: 'Enter the Provider ID.',
        specialty: 'Select a specialty.',
        providerType: 'Select a provider type.',
        npi: 'Enter the NPI.',
        taxonomyCode: 'Enter the taxonomy code.',
      },
    )
  })

  it('refuses an NPI that is not ten digits or is a placeholder', () => {
    expect(errorsOf({ ...filled, npi: '12345' })).toEqual({ npi: 'Please enter a valid NPI.' })
    expect(errorsOf({ ...filled, npi: '9999999999' })).toEqual({ npi: 'Please enter a valid NPI.' })
  })

  it('needs a start date and a reason once the hold has an end date, and an end on or after the start', () => {
    expect(errorsOf({ ...filled, claimHoldUntil: '2026-10-31' })).toEqual({
      claimHoldFrom: 'Enter the date the hold starts.',
      claimHoldReason: 'Enter the reason for the hold.',
    })
    expect(
      errorsOf({
        ...filled,
        claimHoldFrom: '2026-11-01',
        claimHoldUntil: '2026-10-31',
        claimHoldReason: 'Leave',
      }),
    ).toEqual({ claimHoldUntil: 'Please enter a valid date.' })
    expect(errorsOf(filled)).toEqual({})
  })
})

import { describe, expect, it } from 'vitest'
import { authStatus } from '../model/authorization'
import { addressLine, ageOn, maskSsn } from '../model/patient'
import { caseFormSchema, newCaseValues, toCaseValues } from './case-form'
import { newPatientValues, patientFormSchema, toPatientValues } from './patient-form'

const messages = (result: {
  success: boolean
  error?: { issues: Array<{ path: PropertyKey[]; message: string }> }
}) =>
  result.success
    ? []
    : (result.error?.issues ?? []).map((issue) => `${issue.path.join('.')}: ${issue.message}`)

const valid = {
  ...newPatientValues('1'),
  firstName: 'Ada',
  lastName: 'Lin',
  dob: '1990-04-02',
  gender: 'Female',
  line1: '1 Court Street',
  city: 'Brooklyn',
  zip: '11201',
}

describe('the patient form', () => {
  const schema = patientFormSchema({ isNew: true, today: '2026-10-01' })

  it('accepts what billing needs', () => {
    expect(messages(schema.safeParse(valid))).toEqual([])
  })

  it('refuses a birth date in the future and values in the wrong format', () => {
    expect(
      messages(
        schema.safeParse({ ...valid, dob: '2026-10-02', ssn: '123', phoneHome: '555', state: 'N', zip: '1' }),
      ),
    ).toEqual([
      'dob: Please enter a valid date.',
      'ssn: Please enter a valid SSN.',
      'phoneHome: Please enter a valid phone number.',
      'state: Please enter a valid state.',
      'zip: Please enter a valid ZIP code.',
    ])
  })

  it('asks for the guarantor and their address only when another person receives the statements', () => {
    expect(messages(schema.safeParse({ ...valid, guarantorName: '' }))).toEqual([])
    expect(messages(schema.safeParse({ ...valid, guarantorType: 'other' }))).toEqual([
      'guarantorName: Enter the guarantor’s name.',
      'guarantorRelationship: Select the relationship.',
      'guarantorLine1: Enter the guarantor’s address.',
      'guarantorCity: Enter the city.',
      'guarantorState: Enter the state.',
      'guarantorZip: Enter the ZIP code.',
    ])
  })

  it('keeps no guarantor for "The patient", and the guarantor’s address for another person', () => {
    const self = toPatientValues(schema.parse({ ...valid, guarantorName: 'Leftover' }), 1)
    expect(self.guarantor).toBeNull()
    const other = toPatientValues(
      schema.parse({
        ...valid,
        guarantorType: 'other',
        guarantorName: 'Wen Lin',
        guarantorRelationship: 'Parent',
        guarantorLine1: '9 Hicks Street',
        guarantorCity: 'Brooklyn',
        guarantorState: 'ny',
        guarantorZip: '11201',
      }),
      1,
    )
    expect(other.guarantor).toEqual({
      name: 'Wen Lin',
      relationship: 'Parent',
      address: { line1: '9 Hicks Street', city: 'Brooklyn', state: 'NY', zip: '11201' },
    })
  })
})

describe('the case form', () => {
  const schema = caseFormSchema({
    injuryDateRequired: (id) => id === 'pip',
    isWorkersComp: (id) => id === 'wc',
  })
  const base = { ...newCaseValues('2026-10-01'), name: 'R hip', referrerId: '1', primaryCoverageId: 'aetna' }

  it('asks for the injury date when there is a cause, or when the primary insurance requires it', () => {
    expect(messages(schema.safeParse(base))).toEqual([])
    expect(messages(schema.safeParse({ ...base, injuryType: 'Employment Related' }))).toEqual([
      'injuryDate: Enter the injury or onset date.',
    ])
    expect(messages(schema.safeParse({ ...base, primaryCoverageId: 'pip' }))).toEqual([
      'injuryDate: Enter the injury or onset date.',
    ])
  })

  it('asks for the employment status for Workers’ Comp, and a discharge not before the start of care', () => {
    expect(
      messages(schema.safeParse({ ...base, primaryCoverageId: 'wc', dischargeDate: '2026-09-01' })),
    ).toEqual(['employmentStatus: Enter the employment status.', 'dischargeDate: Please enter a valid date.'])
  })

  it('clears the accident state and injury date when there is no cause any more', () => {
    const values = schema.parse({ ...base, injuryDate: '2026-08-01', accidentState: 'NY' })
    expect(toCaseValues(values, false)).toEqual(
      expect.objectContaining({ injuryDate: '', accidentState: '' }),
    )
    expect(toCaseValues(values, true)).toEqual(expect.objectContaining({ injuryDate: '2026-08-01' }))
  })
})

describe('patient helpers', () => {
  it('masks the SSN, counts age in whole years and writes an address on one line', () => {
    expect(maskSsn('412-55-7781')).toBe('***-**-7781')
    expect(maskSsn('')).toBe('')
    expect(ageOn('1984-06-12', '2026-06-11')).toBe(41)
    expect(ageOn('1984-06-12', '2026-06-12')).toBe(42)
    expect(
      addressLine({
        line1: '8622 5th Avenue',
        line2: 'Suite 2',
        city: 'Brooklyn',
        state: 'NY',
        zip: '11209',
      }),
    ).toBe('8622 5th Avenue, Suite 2, Brooklyn, NY 11209')
  })

  it('reads an authorization’s status as the prototype does', () => {
    const auth = {
      id: 'a',
      caseId: 'c',
      coverageId: 'v',
      number: 'N',
      start: '2026-08-01',
      end: '2026-10-31',
      qty: 12,
      unit: 'Visits',
      used: 5,
    }
    expect(authStatus(auth, '2026-07-01').label).toBe('Not started')
    expect(authStatus(auth, '2026-11-01').label).toBe('Expired')
    expect(authStatus(auth, '2026-09-01').label).toBe('Active')
    expect(authStatus({ ...auth, used: 11 }, '2026-09-01').label).toBe('Last visit')
    expect(authStatus({ ...auth, used: 12 }, '2026-09-01').label).toBe('Exhausted')
  })
})

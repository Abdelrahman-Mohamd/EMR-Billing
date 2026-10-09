import { describe, expect, it } from 'vitest'
import { authStatus, type Authorization } from '../model/authorization'
import { addressLine, ageOn, showPhone } from '../model/patient'
import { caseFormSchema, newCaseValues, toCasePayload, toCaseUpdatePayload } from './case-form'
import { patientSchema } from './patient'
import {
  newPatientValues,
  patientFormSchema,
  toPatientFormValues,
  toPatientPayload,
  toPatientUpdatePayload,
} from './patient-form'

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
  gender: 'F',
  line1: '1 Court Street',
  city: 'Brooklyn',
  zip: '11201',
}

describe('the patient form — the server’s checks', () => {
  const schema = patientFormSchema({ isNew: true, today: '2026-10-01' })

  it('accepts what the server needs', () => {
    expect(messages(schema.safeParse(valid))).toEqual([])
  })

  it('refuses a birth date in the future, names too long and values in the wrong format', () => {
    expect(
      messages(
        schema.safeParse({
          ...valid,
          emrId: '12a',
          firstName: 'A'.repeat(36),
          middleName: 'B'.repeat(26),
          dob: '2026-10-02',
          ssn: '123',
          phoneHome: '555',
          state: 'N',
          zip: '1',
        }),
      ),
    ).toEqual([
      'emrId: Please enter a valid EMR ID.',
      'firstName: Use at most 35 characters.',
      'middleName: Use at most 25 characters.',
      'dob: Please enter a valid date.',
      'ssn: Please enter a valid SSN.',
      'phoneHome: Please enter a valid phone number.',
      'state: Please enter a valid state.',
      'zip: Please enter a valid ZIP code.',
    ])
  })

  it('takes an SSN and phones with or without punctuation', () => {
    expect(
      messages(
        schema.safeParse({
          ...valid,
          ssn: '123456789',
          phoneCell: '(718) 555-0142',
          phoneHome: '718.555.0100',
        }),
      ),
    ).toEqual([])
  })

  it('asks for the guarantor’s name and relationship — an address only once begun, then all of it', () => {
    expect(messages(schema.safeParse({ ...valid, guarantorFirstName: '' }))).toEqual([])
    expect(messages(schema.safeParse({ ...valid, guarantorType: 'other' }))).toEqual([
      'guarantorFirstName: Enter the guarantor’s first name.',
      'guarantorLastName: Enter the guarantor’s last name.',
      'guarantorRelationship: Select the relationship.',
    ])
    expect(
      messages(
        schema.safeParse({
          ...valid,
          guarantorType: 'other',
          guarantorFirstName: 'Wen',
          guarantorLastName: 'Lin',
          guarantorRelationship: 'Parent',
          guarantorCity: 'Brooklyn',
        }),
      ),
    ).toEqual([
      'guarantorLine1: Enter the guarantor’s address.',
      'guarantorState: Enter the state.',
      'guarantorZip: Enter the ZIP code.',
    ])
  })
})

describe('the patient payload (contract confirmed 2026-10-08)', () => {
  const schema = patientFormSchema({ isNew: true, today: '2026-10-01' })

  it('creates with the confirmed body: phones as digits, nulls for what is empty, no guarantor for “The patient”', () => {
    expect(
      toPatientPayload(
        schema.parse({
          ...valid,
          ssn: '123-45-6789',
          phoneCell: '(718) 555-0142',
          guarantorFirstName: 'Leftover',
        }),
      ),
    ).toEqual({
      practice_id: 1,
      emr_id: null,
      first_name: 'Ada',
      middle_name: null,
      last_name: 'Lin',
      date_of_birth: '1990-04-02',
      gender: 'F',
      ssn: '123-45-6789',
      address: '1 Court Street',
      address_line2: null,
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11201',
      phone_home: null,
      phone_cell: '7185550142',
      email: null,
      guarantor: null,
      notes: null,
      no_statements: false,
    })
  })

  it('sends another person as the guarantor, with their address only when given', () => {
    const other = {
      ...valid,
      guarantorType: 'other' as const,
      guarantorFirstName: 'Wen',
      guarantorLastName: 'Lin',
      guarantorRelationship: 'Parent',
    }
    expect(toPatientPayload(schema.parse(other)).guarantor).toEqual({
      first_name: 'Wen',
      last_name: 'Lin',
      relationship: 'Parent',
      date_of_birth: null,
      address: null,
    })
    expect(
      toPatientPayload(
        schema.parse({
          ...other,
          guarantorDob: '1960-02-01',
          guarantorLine1: '9 Hicks Street',
          guarantorCity: 'Brooklyn',
          guarantorState: 'ny',
          guarantorZip: '11201',
        }),
      ).guarantor,
    ).toEqual({
      first_name: 'Wen',
      last_name: 'Lin',
      relationship: 'Parent',
      date_of_birth: '1960-02-01',
      address: { line1: '9 Hicks Street', city: 'Brooklyn', state: 'NY', zip: '11201' },
    })
  })

  it('saves without the practice, and without the SSN unless one was typed — an empty one would erase it', () => {
    const save = toPatientUpdatePayload(schema.parse(valid))
    expect(save).not.toHaveProperty('practice_id')
    expect(save).not.toHaveProperty('ssn')
  })

  it('reads the server’s patient back into the form — the SSN never put in a field', () => {
    const patient = patientSchema.parse({
      id: 1,
      practice_id: 1,
      emr_id: 56361649,
      first_name: 'John',
      middle_name: 'A',
      last_name: 'Doe',
      date_of_birth: '1985-04-12',
      gender: 'M',
      gender_label: 'Male',
      ssn: '***-**-6789',
      address: '1 Main St',
      address_line2: 'Apt 4B',
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11209',
      phone_home: '7185550100',
      phone_cell: '7185550142',
      email: 'john.doe@example.com',
      guarantor: {
        address: { zip: '11209', city: 'Brooklyn', line1: '2 Main St', state: 'NY' },
        last_name: 'Doe',
        first_name: 'Mary',
        relationship: 'Parent',
        date_of_birth: '1960-02-01',
      },
      no_statements: true,
      notes: 'Prefers morning appointments',
      is_active: true,
      practice: { id: 1, name: 'Physical Therapy of The City' },
      cases: [{ id: 1, name: 'Default', is_active: true }],
      created_at: '2026-10-08T17:30:12.000000Z',
      updated_at: '2026-10-08T17:30:12.000000Z',
    })
    expect(patient).toMatchObject({
      id: '1',
      billingId: 1,
      maskedSsn: '***-**-6789',
      genderLabel: 'Male',
      noStatements: true,
      cases: [{ id: '1', name: 'Default', isActive: true }],
    })
    expect(toPatientFormValues(patient)).toMatchObject({
      emrId: '56361649',
      ssn: '',
      phoneHome: '718-555-0100',
      guarantorType: 'other',
      guarantorFirstName: 'Mary',
      guarantorDob: '1960-02-01',
      guarantorLine1: '2 Main St',
      noStatements: true,
    })
  })
})

describe('the case form — the server’s checks', () => {
  const schema = caseFormSchema('2026-10-01')
  const base = { ...newCaseValues('2026-10-01'), name: 'R hip' }

  it('needs only a name — the physician and insurance are optional — and at most 100 characters', () => {
    expect(messages(schema.safeParse(base))).toEqual([])
    expect(messages(schema.safeParse({ ...base, name: '' }))).toEqual(['name: Enter the case name.'])
    expect(messages(schema.safeParse({ ...base, name: 'N'.repeat(101) }))).toEqual([
      'name: Use at most 100 characters.',
    ])
  })

  it('asks for the accident state for an auto accident, and refuses dates out of order', () => {
    expect(messages(schema.safeParse({ ...base, injuryType: 'auto' }))).toEqual([
      'accidentState: Enter the accident state.',
    ])
    expect(
      messages(
        schema.safeParse({
          ...base,
          injuryDate: '2026-10-02',
          startOfCare: '2026-09-10',
          dischargeDate: '2026-09-01',
        }),
      ),
    ).toEqual(['injuryDate: Please enter a valid date.', 'dischargeDate: Please enter a valid date.'])
  })

  it('creates with the contract’s body — nulls for what is empty', () => {
    const values = schema.parse({
      ...base,
      referrerId: '2',
      injuryType: 'auto',
      injuryDate: '2026-06-01',
      accidentState: 'ny',
      startOfCare: '2026-07-10',
    })
    expect(toCasePayload('3', values, false)).toEqual({
      patient_id: 3,
      name: 'R hip',
      referring_physician_id: 2,
      injury_type: 'auto',
      injury_date: '2026-06-01',
      accident_state: 'NY',
      start_of_care: '2026-07-10',
      discharge_date: null,
      is_active: true,
    })
  })

  it('clears the accident state and injury date when there is no cause any more — unless the payer needs the date', () => {
    const values = schema.parse({ ...base, injuryDate: '2026-08-01', accidentState: 'NY' })
    expect(toCaseUpdatePayload(values, false)).toEqual(
      expect.objectContaining({ injury_type: null, injury_date: null, accident_state: null }),
    )
    expect(toCaseUpdatePayload(values, true)).toEqual(expect.objectContaining({ injury_date: '2026-08-01' }))
    expect(toCaseUpdatePayload(values, false)).not.toHaveProperty('patient_id')
  })
})

describe('patient helpers', () => {
  it('shows a phone, counts age in whole years and writes an address on one line', () => {
    expect(showPhone('7185550100')).toBe('718-555-0100')
    expect(showPhone('')).toBe('')
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
    const auth: Authorization = {
      id: 'a',
      caseId: 'c',
      coverageId: 'v',
      insuranceName: '1039 – Corvel Enterprise',
      number: 'N',
      start: '2026-08-01',
      end: '2026-10-31',
      qty: 12,
      unit: 'visits',
      used: 5,
      remaining: 7,
    }
    expect(authStatus(auth, '2026-07-01').label).toBe('Not started')
    expect(authStatus(auth, '2026-11-01').label).toBe('Expired')
    expect(authStatus(auth, '2026-09-01').label).toBe('Active')
    // What is left is the server's count.
    expect(authStatus({ ...auth, used: 11, remaining: 1 }, '2026-09-01').label).toBe('Last visit')
    expect(authStatus({ ...auth, unit: 'units', remaining: 1 }, '2026-09-01').label).toBe('Last unit')
    expect(authStatus({ ...auth, used: 12, remaining: 0 }, '2026-09-01').label).toBe('Exhausted')
  })
})

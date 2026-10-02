import type { Insurance, InsuranceClass } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import type { ReferringPhysician } from '@/features/admin-referring-physicians'
import type { Authorization } from '../model/authorization'
import type { PatientCase } from '../model/case'
import type { Coverage } from '../model/coverage'
import type { Patient } from '../model/patient'

/**
 * Test fixtures for the Patients screens: invented people only. The other
 * features' records are built here as their lists return them; the tests fake
 * those lists by path (lint forbids importing another feature's internals).
 */
export const practice = (id: number, name: string): Practice => ({
  id,
  organizationId: null,
  code: `P${id}`,
  name,
  dbaName: undefined,
  npi: '1609847312',
  taxId: '84-2217765',
  taxonomyCode: '225100000X',
  address: { line1: '1 Main Street', city: 'Brooklyn', state: 'NY', zip: '11209' },
  isActive: true,
  locations: [],
})

const noOverrides = {
  authorizationRequired: null,
  injuryDateRequired: null,
  applySpecialtyModifiers: null,
  acceptAssignment: null,
  icdVersion: null,
}

// Only what Patients reads; the rest of an insurance does not matter here.
export const insurance = (
  id: number,
  name: string,
  overrides: Partial<Insurance> & { insuranceClassId?: number } = {},
): Insurance =>
  ({
    id,
    practiceId: 1,
    insuranceClassId: 1,
    code: 1000 + id,
    name,
    insuranceType: 'Commercial',
    payerId: `PAY${id}`,
    rules: noOverrides,
    insuranceHold: false,
    isActive: true,
    ...overrides,
  }) as Insurance

export const insuranceClass = (id: number, name: string, overrides: Partial<InsuranceClass> = {}) => ({
  id,
  practiceId: 1,
  code: `C${id}`,
  name,
  authorizationRequired: false,
  injuryDateRequired: false,
  applySpecialtyModifiers: false,
  acceptAssignment: true,
  icdVersion: 'ICD10',
  isActive: true,
  ...overrides,
})

export const referrer = (id: number, name: string, npi = '1720394851'): ReferringPhysician => ({
  id,
  practiceId: 1,
  code: `R${id}`,
  name,
  type: 'DN',
  npi,
})

export const patient = (
  overrides: Partial<Patient> & Pick<Patient, 'id' | 'firstName' | 'lastName'>,
): Patient => ({
  practiceId: 1,
  billingId: 10412,
  emrId: 56361773,
  middleName: '',
  dob: '1984-06-12',
  gender: 'Female',
  ssn: '',
  phoneCell: '718-555-0142',
  phoneHome: '',
  email: '',
  address: { line1: '412 Ovington Avenue', line2: '', city: 'Brooklyn', state: 'NY', zip: '11209' },
  guarantor: null,
  notes: '',
  isActive: true,
  ...overrides,
})

export const coverage = (
  overrides: Partial<Coverage> & Pick<Coverage, 'id' | 'patientId' | 'insuranceId'>,
): Coverage => ({
  memberId: 'W284019733',
  groupNumber: '0184421',
  claimNumber: '',
  subscriber: null,
  employer: null,
  ...overrides,
})

export const patientCase = (
  overrides: Partial<PatientCase> & Pick<PatientCase, 'id' | 'patientId' | 'name'>,
): PatientCase => ({
  referrerId: 1,
  primaryCoverageId: null,
  secondaryCoverageId: null,
  injuryType: '',
  injuryDate: '',
  accidentState: '',
  employmentStatus: '',
  startOfCare: '2026-08-04',
  dischargeDate: '',
  isActive: true,
  diagnoses: [],
  ...overrides,
})

export const authorization = (
  overrides: Partial<Authorization> & Pick<Authorization, 'id' | 'caseId' | 'coverageId' | 'number'>,
): Authorization => ({
  start: '2026-08-01',
  end: '2099-10-31',
  qty: 12,
  unit: 'Visits',
  used: 0,
  ...overrides,
})

export const ICD10 = [
  { code: 'M54.50', description: 'Low back pain, unspecified' },
  { code: 'M54.2', description: 'Cervicalgia' },
  { code: 'M25.511', description: 'Pain in right shoulder' },
  { code: 'M75.101', description: 'Unspecified rotator cuff tear of right shoulder, not traumatic' },
]

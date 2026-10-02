import type { Practice } from '@/features/admin-practices'
import type { ReleaseBucket } from '@/features/admin-release-buckets'
import { insuranceClassResponseSchema, type InsuranceClass } from '../schemas/insurance-class'
import { insuranceResponseSchema, type Insurance } from '../schemas/insurance'

/** Records for the screen tests, built through the real response schemas. */
export function practice(id: number, name: string): Practice {
  return {
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
  }
}

export function insuranceClass(
  id: number,
  practiceId: number,
  code: string,
  name: string,
  overrides: Partial<Record<string, unknown>> = {},
): InsuranceClass {
  return insuranceClassResponseSchema.parse({
    id,
    practice_id: practiceId,
    code,
    name,
    authorization_required: false,
    injury_date_required: false,
    apply_specialty_modifiers: true,
    accept_assignment: true,
    icd_version: 'ICD10',
    is_active: true,
    ...overrides,
  })
}

export function insurance(
  id: number,
  practiceId: number,
  classId: number,
  code: number,
  name: string,
  overrides: Partial<Record<string, unknown>> = {},
): Insurance {
  return insuranceResponseSchema.parse({
    id,
    practice_id: practiceId,
    insurance_class_id: classId,
    code,
    name,
    insurance_type: 'Commercial',
    payer_id: `P${code}`,
    address: { line1: 'PO Box 1', city: 'Albany', state: 'NY', zip: '12201' },
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
    ...overrides,
  })
}

export function bucket(id: number, practiceId: number, name: string): ReleaseBucket {
  return { id, practiceId, name, description: '' }
}

import type { Practice } from '@/features/admin-practices'
import type { ReleaseBucket } from '@/features/admin-release-buckets'
import { insuranceClassResponseSchema, type InsuranceClass } from '../schemas/insurance-class'
import {
  insuranceDetailResponseSchema,
  insuranceResponseSchema,
  type Insurance,
  type InsuranceDetail,
} from '../schemas/insurance'

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

/** An insurance as the list sends it (confirmed shape, 2026-10-08); overrides in wire names. */
export function insuranceWire(
  id: number,
  practiceId: number,
  classId: number,
  code: number,
  name: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    practice_id: practiceId,
    code,
    name,
    display_name: `${code} – ${name}`,
    insurance_type: 'CI',
    insurance_type_label: 'Commercial',
    payer_id: `P${code}`,
    insurance_hold: false,
    authorization_required: null,
    injury_date_required: null,
    apply_specialty_modifiers: null,
    accept_assignment: null,
    audit_required: false,
    is_active: true,
    insurance_class: { id: classId, name: `Class ${classId}` },
    release_bucket: null,
    created_at: '2026-10-08T13:01:21.000000Z',
    ...overrides,
  }
}

/** An insurance as the list has it, built through the real response schema. */
export function insurance(
  id: number,
  practiceId: number,
  classId: number,
  code: number,
  name: string,
  overrides: Partial<Record<string, unknown>> = {},
): Insurance {
  return insuranceResponseSchema.parse(insuranceWire(id, practiceId, classId, code, name, overrides))
}

/**
 * An insurance in full, as `GET /insurances/{id}` sends it — the list item's
 * fields plus the record's own; `extra` in wire names.
 */
export function insuranceDetail(
  item: Insurance,
  extra: Partial<Record<string, unknown>> = {},
): InsuranceDetail {
  return insuranceDetailResponseSchema.parse({
    data: {
      id: item.id,
      practice_id: item.practiceId,
      insurance_class_id: item.insuranceClassId,
      code: item.code,
      name: item.name,
      insurance_type: item.insuranceType,
      payer_id: item.payerId,
      claim_format: '837P',
      payment_sla_days: null,
      address: 'PO Box 1',
      address_line2: null,
      city: 'Albany',
      state: 'NY',
      zip_code: '12201',
      phone: null,
      fax: null,
      authorization_required: item.rules.authorizationRequired,
      injury_date_required: item.rules.injuryDateRequired,
      apply_specialty_modifiers: item.rules.applySpecialtyModifiers,
      accept_assignment: item.rules.acceptAssignment,
      icd_version: null,
      insurance_hold: item.insuranceHold,
      audit_required: item.auditRequired,
      release_bucket_id: item.releaseBucketId,
      portal_url: null,
      is_active: item.isActive,
      ...extra,
    },
  })
}

export function bucket(id: number, practiceId: number, name: string): ReleaseBucket {
  return { id, practiceId, name, description: '', isActive: true, insurancesCount: 0 }
}

import { ApiError } from '@/lib/api/api-error'
import type { InsurancePayload } from '../schemas/insurance'
import type { InsurancesApi } from './insurances-api'

/**
 * In-memory insurances for development and demos (ADR 0006). Never part of a
 * production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the provisional payload and answers in wire
 * format. It enforces the one rule V2 states — an insurance code is unique
 * within its practice — and nothing else.
 *
 * Invented data only: the prototype's payers (fictional member data aside),
 * in the practices mock's practices 1 and 2, pointing at the insurance classes
 * mock's classes and the release buckets mock's buckets. Portal links use
 * reserved example domains.
 */
type InsuranceRecord = InsurancePayload & { id: number }

const LATENCY_MS = 250

const defaults = {
  phone: '800-555-0100',
  fax: '800-555-0199',
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
  portal_url: 'https://provider.example-payer.com',
  is_active: true,
}

let insurances: InsuranceRecord[] = [
  {
    ...defaults,
    id: 1,
    practice_id: 1,
    insurance_class_id: 1,
    code: 1001,
    name: 'Medicare Part B',
    insurance_type: 'Medicare',
    payer_id: '13202',
    address: { line1: 'PO Box 6178', city: 'Indianapolis', state: 'IN', zip: '46206' },
    max_units: 4,
    sla_days: 14,
    portal_url: 'https://portal.example-medicare.gov',
  },
  {
    ...defaults,
    id: 2,
    practice_id: 1,
    insurance_class_id: 2,
    code: 1002,
    name: 'Empire BlueCross BlueShield',
    insurance_type: 'Commercial',
    payer_id: '803',
    address: { line1: 'PO Box 1407, Church Street Station', city: 'New York', state: 'NY', zip: '10008' },
  },
  {
    ...defaults,
    id: 3,
    practice_id: 1,
    insurance_class_id: 3,
    code: 1003,
    name: 'Aetna',
    insurance_type: 'Commercial',
    payer_id: '60054',
    address: { line1: 'PO Box 981106', city: 'El Paso', state: 'TX', zip: '79998' },
  },
  {
    ...defaults,
    id: 4,
    practice_id: 1,
    insurance_class_id: 3,
    code: 1004,
    name: 'UnitedHealthcare',
    insurance_type: 'Commercial',
    payer_id: '87726',
    address: { line1: 'PO Box 30555', city: 'Salt Lake City', state: 'UT', zip: '84130' },
    authorization_required: true,
    max_units: 4,
  },
  {
    ...defaults,
    id: 5,
    practice_id: 1,
    insurance_class_id: 4,
    code: 1039,
    name: 'Corvel Enterprise',
    insurance_type: 'Workers Comp',
    payer_id: 'CORVEL',
    address: { line1: 'PO Box 7600', city: 'Portland', state: 'OR', zip: '97208' },
    claim_format: 'CMS1500',
    sla_days: 45,
    audit_required: true,
  },
  {
    ...defaults,
    id: 6,
    practice_id: 1,
    insurance_class_id: 5,
    code: 1050,
    name: 'GEICO No-Fault',
    insurance_type: 'PIP',
    payer_id: 'GEICO',
    address: { line1: 'PO Box 9091', city: 'Macon', state: 'GA', zip: '31208' },
    insurance_hold: true,
    release_bucket_id: 1,
    claim_format: 'CMS1500',
    sla_days: 45,
  },
  {
    ...defaults,
    id: 7,
    practice_id: 1,
    insurance_class_id: 3,
    code: 1006,
    name: 'Cigna',
    insurance_type: 'Commercial',
    payer_id: '62308',
    address: { line1: 'PO Box 188061', city: 'Chattanooga', state: 'TN', zip: '37422' },
  },
  {
    ...defaults,
    id: 8,
    practice_id: 1,
    insurance_class_id: 6,
    code: 1008,
    name: 'AARP Medicare Supplement',
    insurance_type: 'Commercial',
    payer_id: '36273',
    address: { line1: 'PO Box 740819', city: 'Atlanta', state: 'GA', zip: '30374' },
    portal_url: null,
    is_active: false,
  },
  {
    ...defaults,
    id: 9,
    practice_id: 2,
    insurance_class_id: 7,
    code: 2001,
    name: 'Medicare Part B',
    insurance_type: 'Medicare',
    payer_id: '13202',
    address: { line1: 'PO Box 6178', city: 'Indianapolis', state: 'IN', zip: '46206' },
    max_units: 4,
    sla_days: 14,
  },
  {
    ...defaults,
    id: 10,
    practice_id: 2,
    insurance_class_id: 8,
    code: 2002,
    name: 'Aetna',
    insurance_type: 'Commercial',
    payer_id: '60054',
    address: { line1: 'PO Box 981106', city: 'El Paso', state: 'TX', zip: '79998' },
  },
]
let nextId = 11

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

function rejectDuplicateCode(practiceId: number, code: number, exceptId?: number): void {
  const taken = insurances.some(
    (record) => record.practice_id === practiceId && record.id !== exceptId && record.code === code,
  )
  if (taken) {
    throw new ApiError({
      kind: 'validation',
      message: 'Some fields need attention.',
      status: 422,
      fieldErrors: [{ path: 'code', message: 'This code is already used in this practice.' }],
    })
  }
}

export const mockInsurancesApi: InsurancesApi = {
  async list() {
    await wait()
    return insurances.map((record) => ({ ...record, address: { ...record.address } }))
  },
  async create(payload) {
    await wait()
    rejectDuplicateCode(payload.practice_id, payload.code)
    const created: InsuranceRecord = { ...payload, id: nextId++ }
    insurances = [...insurances, created]
    return { ...created }
  },
  async update(id, payload) {
    await wait()
    if (!insurances.some((record) => record.id === id)) {
      throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
    }
    rejectDuplicateCode(payload.practice_id, payload.code, id)
    const updated: InsuranceRecord = { ...payload, id }
    insurances = insurances.map((record) => (record.id === id ? updated : record))
    return { ...updated }
  },
}

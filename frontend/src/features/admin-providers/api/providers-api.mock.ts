import { ApiError } from '@/lib/api/api-error'
import type { ProviderPayload } from '../schemas/provider'
import type { ProvidersApi } from './providers-api'

/**
 * In-memory providers for development and demos (ADR 0006). Never part of a
 * production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the provisional payload and answers in wire
 * format. It enforces nothing beyond what the payload needs — V2 states no
 * uniqueness rule for providers.
 *
 * Invented data only: the prototype's fictional clinicians, in the practices
 * mock's practices 1 and 2. The claim holds point at that mock's locations
 * (1–3 in practice 1) and the insurances mock's payers (1–8 in practice 1).
 * Hold dates are relative to today, so a running and a finished hold can both
 * be seen.
 */
type ProviderRecord = ProviderPayload & { id: number }

const LATENCY_MS = 250

const isoDaysFromToday = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const base = {
  practice_id: 1,
  credential: 'PT',
  specialty: 'PHYSICAL THERAPIST',
  provider_type: 'Billing',
  taxonomy_code: '225100000X',
  state_license: null,
  claim_hold_from: null,
  claim_hold_until: null,
  claim_hold_reason: null,
  claim_hold_location_ids: [],
  claim_hold_insurance_ids: [],
  is_active: true,
}

let providers: ProviderRecord[] = [
  {
    ...base,
    id: 1,
    code: '297',
    first_name: 'Aisha',
    last_name: 'Rahman',
    credential: 'PT, DPT',
    npi: '1356482917',
    state_license: 'NY 041822',
  },
  {
    ...base,
    id: 2,
    code: '301',
    first_name: 'Marcus',
    last_name: 'Delaney',
    npi: '1467593028',
    state_license: 'NY 043517',
  },
  {
    ...base,
    id: 3,
    code: '305',
    first_name: 'Elena',
    last_name: 'Petrova',
    credential: 'PT, DPT',
    npi: '1578604139',
    state_license: 'NY 044902',
    claim_hold_from: isoDaysFromToday(-60),
    claim_hold_until: isoDaysFromToday(-30),
    claim_hold_reason: 'Extended leave',
  },
  {
    ...base,
    id: 4,
    code: '318',
    first_name: 'Jordan',
    last_name: 'Okafor',
    provider_type: 'Rendering',
    npi: '1689715240',
    state_license: 'NY 047731',
    claim_hold_from: isoDaysFromToday(-14),
    claim_hold_until: isoDaysFromToday(14),
    claim_hold_reason: 'Pending Provider Credentialing',
    claim_hold_location_ids: [1],
    claim_hold_insurance_ids: [3, 4],
  },
  {
    ...base,
    id: 5,
    code: '322',
    first_name: 'Sofia',
    last_name: 'Marchetti',
    credential: 'OTR/L',
    specialty: 'OCCUPATIONAL THERAPIST',
    taxonomy_code: '225X00000X',
    npi: '1790826351',
    state_license: 'NY 012290',
  },
  {
    ...base,
    id: 6,
    code: '327',
    first_name: 'Caleb',
    last_name: 'Wright',
    npi: '',
    state_license: 'NY 048115',
    is_active: false,
  },
  {
    ...base,
    id: 7,
    practice_id: 2,
    code: '110',
    first_name: 'Noah',
    last_name: 'Feldman',
    credential: 'PT, DPT',
    npi: '1801937462',
    state_license: 'NY 039981',
  },
]
let nextId = 8

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

export const mockProvidersApi: ProvidersApi = {
  async list() {
    await wait()
    return providers.map((record) => ({ ...record }))
  },
  async create(payload) {
    await wait()
    const created: ProviderRecord = { ...payload, id: nextId++ }
    providers = [...providers, created]
    return { ...created }
  },
  async update(id, payload) {
    await wait()
    if (!providers.some((record) => record.id === id)) {
      throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
    }
    const updated: ProviderRecord = { ...payload, id }
    providers = providers.map((record) => (record.id === id ? updated : record))
    return { ...updated }
  },
}

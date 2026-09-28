import { ApiError } from '@/lib/api/api-error'
import type { LocationPayload, PracticeLocationPayload, PracticePayload } from '../schemas/practice-payload'
import type { PracticesApi } from './practices-api'

/**
 * In-memory practices and locations for development and demos (ADR 0006).
 * Never part of a production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it takes the real request payloads and answers in wire
 * format. It enforces the one rule V2 states — a location code is unique
 * within its practice (§10.2) — and nothing else. Things only a real server
 * can decide are the mock's guesses and marked as such.
 *
 * Invented data only: the prototype's fictional practices and sites. The
 * organization id is the one the organizations mock uses.
 */
type LocationRecord = LocationPayload & { id: number }
type PracticeRecord = Omit<PracticePayload, 'locations'> & { id: number }

const LATENCY_MS = 250

let practices: PracticeRecord[] = [
  {
    id: 1,
    organization_id: 1,
    code: 'HPT1',
    name: 'Harborline Physical Therapy',
    dba_name: 'Harborline PT',
    npi: '1609847312',
    tax_id: '84-2217765',
    taxonomy_code: '225100000X',
    address: { line1: '8622 5th Avenue', line2: 'Suite 2', city: 'Brooklyn', state: 'NY', zip: '11209' },
    is_active: true,
  },
  {
    id: 2,
    organization_id: 1,
    code: 'NSS2',
    name: 'Northgate Sports & Spine',
    npi: '1710958423',
    tax_id: '87-4410932',
    taxonomy_code: '225100000X',
    address: {
      line1: '45 Northern Boulevard',
      line2: 'Floor 3',
      city: 'Great Neck',
      state: 'NY',
      zip: '11021',
    },
    is_active: true,
  },
]

let locations: LocationRecord[] = [
  location(1, 1, 'BR003', 'Bay Ridge', '1609847312', '8622 5th Avenue, Suite 2', 'Brooklyn', '11209'),
  location(2, 1, 'PS002', 'Park Slope', '1821069534', '214 7th Avenue', 'Brooklyn', '11215'),
  location(
    3,
    1,
    'SI004',
    'Staten Island Annex',
    '1932170645',
    '1200 Richmond Road',
    'Staten Island',
    '10304',
  ),
  location(
    4,
    2,
    'NG001',
    'Northgate Main',
    '1710958423',
    '45 Northern Boulevard, Floor 3',
    'Great Neck',
    '11021',
  ),
]

let nextPracticeId = 3
let nextLocationId = 5

function location(
  id: number,
  practiceId: number,
  code: string,
  name: string,
  npi: string,
  line1: string,
  city: string,
  zip: string,
): LocationRecord {
  return {
    id,
    practice_id: practiceId,
    code,
    name,
    npi,
    address: { line1, city, state: 'NY', zip },
    place_of_service: '11',
    is_active: true,
  }
}

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

const withLocations = (practice: PracticeRecord) => ({
  ...practice,
  locations: locations.filter((l) => l.practice_id === practice.id).map((l) => ({ ...l })),
})

function rejectDuplicateCode(practiceId: number, code: string, exceptId?: number): void {
  const taken = locations.some(
    (l) => l.practice_id === practiceId && l.id !== exceptId && l.code.toLowerCase() === code.toLowerCase(),
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

function notFound(): never {
  throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
}

export const mockPracticesApi: PracticesApi = {
  async listPractices() {
    await wait()
    return practices.map(withLocations)
  },
  async createPractice({ locations: firstLocations = [], ...payload }) {
    await wait()
    const practice: PracticeRecord = { ...payload, id: nextPracticeId++ }
    practices = [...practices, practice]
    // Mock's guess: a location created with its practice starts active (the
    // nested payload carries no `is_active`).
    locations = [
      ...locations,
      ...firstLocations.map((l: PracticeLocationPayload) => ({
        ...l,
        id: nextLocationId++,
        practice_id: practice.id,
        is_active: true,
      })),
    ]
    return withLocations(practice)
  },
  async updatePractice(id, { locations: _ignored, ...payload }) {
    await wait()
    if (!practices.some((p) => p.id === id)) notFound()
    const updated: PracticeRecord = { ...payload, id }
    practices = practices.map((p) => (p.id === id ? updated : p))
    return withLocations(updated)
  },
  async createLocation(payload) {
    await wait()
    if (!practices.some((p) => p.id === payload.practice_id)) notFound()
    rejectDuplicateCode(payload.practice_id, payload.code)
    const created: LocationRecord = { ...payload, id: nextLocationId++ }
    locations = [...locations, created]
    return { ...created }
  },
  async updateLocation(id, payload) {
    await wait()
    if (!locations.some((l) => l.id === id)) notFound()
    rejectDuplicateCode(payload.practice_id, payload.code, id)
    const updated: LocationRecord = { ...payload, id }
    locations = locations.map((l) => (l.id === id ? updated : l))
    return { ...updated }
  },
}

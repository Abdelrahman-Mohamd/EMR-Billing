import { ApiError } from '@/lib/api/api-error'
import type { ReferringPhysicianPayload } from '../schemas/referring-physician'
import type { ReferringPhysiciansApi } from './referring-physicians-api'

/**
 * In-memory referring physicians for development and demos (ADR 0006). Never
 * part of a production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the real payload and answers in wire
 * format. It enforces the one rule V2 states — a code is unique within its
 * practice — and nothing else.
 *
 * Invented data only: the prototype's fictional physicians, with invented
 * codes (the prototype has none), in the practices mock's practices 1 and 2.
 * One carries a dummy NPI so the list's invalid-NPI mark can be seen.
 */
type PhysicianRecord = ReferringPhysicianPayload & { id: number }

const LATENCY_MS = 250

let physicians: PhysicianRecord[] = [
  { id: 1, practice_id: 1, code: 'PN01', name: 'Priya Natarajan, MD', type: 'DN', npi: '1720394851' },
  { id: 2, practice_id: 1, code: 'TB02', name: 'Thomas Beckett, MD', type: 'DN', npi: '1831405962' },
  { id: 3, practice_id: 1, code: 'HM03', name: 'Hannah Morales, DO', type: 'DN', npi: '1942516073' },
  { id: 4, practice_id: 1, code: 'KA04', name: 'Kwame Asante, MD', type: 'DN', npi: '1053627184' },
  { id: 5, practice_id: 1, code: 'LV05', name: 'Leonard Voss, MD', type: 'DN', npi: '9999999999' },
  { id: 6, practice_id: 1, code: 'RS06', name: 'Rebecca Stone, MD', type: 'DQ', npi: '1164738295' },
  { id: 7, practice_id: 2, code: 'SO01', name: 'Samuel Ortiz, MD', type: 'DN', npi: '1275849306' },
]
let nextId = 8

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

function rejectDuplicateCode(practiceId: number, code: string, exceptId?: number): void {
  const taken = physicians.some(
    (physician) =>
      physician.practice_id === practiceId &&
      physician.id !== exceptId &&
      physician.code.toLowerCase() === code.toLowerCase(),
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

export const mockReferringPhysiciansApi: ReferringPhysiciansApi = {
  async list() {
    await wait()
    return physicians.map((physician) => ({ ...physician }))
  },
  async create(payload) {
    await wait()
    rejectDuplicateCode(payload.practice_id, payload.code)
    const created: PhysicianRecord = { ...payload, id: nextId++ }
    physicians = [...physicians, created]
    return { ...created }
  },
  async update(id, payload) {
    await wait()
    if (!physicians.some((physician) => physician.id === id)) {
      throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
    }
    rejectDuplicateCode(payload.practice_id, payload.code, id)
    const updated: PhysicianRecord = { ...payload, id }
    physicians = physicians.map((physician) => (physician.id === id ? updated : physician))
    return { ...updated }
  },
}

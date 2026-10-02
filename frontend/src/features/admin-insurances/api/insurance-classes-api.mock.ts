import { ApiError } from '@/lib/api/api-error'
import type { InsuranceClassPayload } from '../schemas/insurance-class'
import type { InsuranceClassesApi } from './insurance-classes-api'

/**
 * In-memory insurance classes for development and demos (ADR 0006). Never part
 * of a production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the provisional payload and answers in wire
 * format. It enforces the one rule V2 states — a class code is unique within
 * its practice — and nothing else.
 *
 * Invented data only: the prototype's classes, in the practices mock's
 * practices 1 and 2.
 */
type ClassRecord = InsuranceClassPayload & { id: number }

const LATENCY_MS = 250

const defaults = {
  authorization_required: false,
  injury_date_required: false,
  apply_specialty_modifiers: true,
  accept_assignment: true,
  icd_version: 'ICD10',
  is_active: true,
}

let classes: ClassRecord[] = [
  { ...defaults, id: 1, practice_id: 1, code: 'MED', name: 'Medicare' },
  { ...defaults, id: 2, practice_id: 1, code: 'BS', name: 'Blue Shield', authorization_required: true },
  { ...defaults, id: 3, practice_id: 1, code: 'COM', name: 'Commercial' },
  {
    ...defaults,
    id: 4,
    practice_id: 1,
    code: 'WC',
    name: 'Worker’s Comp',
    authorization_required: true,
    injury_date_required: true,
  },
  { ...defaults, id: 5, practice_id: 1, code: 'AUTO', name: 'Auto / No-Fault', injury_date_required: true },
  {
    ...defaults,
    id: 6,
    practice_id: 1,
    code: 'MG',
    name: 'Medicare Supplement',
    apply_specialty_modifiers: false,
  },
  { ...defaults, id: 7, practice_id: 2, code: 'MED', name: 'Medicare' },
  { ...defaults, id: 8, practice_id: 2, code: 'COM', name: 'Commercial' },
]
let nextId = 9

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

function rejectDuplicateCode(practiceId: number, code: string, exceptId?: number): void {
  const taken = classes.some(
    (record) =>
      record.practice_id === practiceId &&
      record.id !== exceptId &&
      record.code.toLowerCase() === code.toLowerCase(),
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

export const mockInsuranceClassesApi: InsuranceClassesApi = {
  async list() {
    await wait()
    return classes.map((record) => ({ ...record }))
  },
  async create(payload) {
    await wait()
    rejectDuplicateCode(payload.practice_id, payload.code)
    const created: ClassRecord = { ...payload, id: nextId++ }
    classes = [...classes, created]
    return { ...created }
  },
  async update(id, payload) {
    await wait()
    if (!classes.some((record) => record.id === id)) {
      throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
    }
    rejectDuplicateCode(payload.practice_id, payload.code, id)
    const updated: ClassRecord = { ...payload, id }
    classes = classes.map((record) => (record.id === id ? updated : record))
    return { ...updated }
  },
}

import { ApiError } from '@/lib/api/api-error'
import type { ReleaseBucketPayload } from '../schemas/release-bucket'
import type { ReleaseBucketsApi } from './release-buckets-api'

/**
 * In-memory release buckets for development and demos (ADR 0006). Never part
 * of a production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the real payload and answers in wire
 * format. It enforces the one rule V2 states — a bucket name is unique within
 * its practice — and nothing else.
 *
 * Invented data only: the prototype's buckets, in the practices mock's
 * practices 1 and 2. Ids 1 and 4 are the ones the insurances mock points at.
 */
type BucketRecord = ReleaseBucketPayload & { id: number }

const LATENCY_MS = 250

let buckets: BucketRecord[] = [
  {
    id: 1,
    practice_id: 1,
    name: 'Manual Release – Auto / No-Fault',
    description: 'No-fault carriers: attach the NF-3 before release.',
  },
  {
    id: 2,
    practice_id: 1,
    name: 'Manual Release – WC Payers',
    description: 'Workers’ comp payers reviewed before sending.',
  },
  { id: 4, practice_id: 2, name: 'Manual Release – Northgate', description: '' },
]
let nextId = 5

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

function rejectDuplicateName(practiceId: number, name: string, exceptId?: number): void {
  const taken = buckets.some(
    (bucket) =>
      bucket.practice_id === practiceId &&
      bucket.id !== exceptId &&
      bucket.name.toLowerCase() === name.toLowerCase(),
  )
  if (taken) {
    throw new ApiError({
      kind: 'validation',
      message: 'Some fields need attention.',
      status: 422,
      fieldErrors: [{ path: 'name', message: 'This name is already used in this practice.' }],
    })
  }
}

export const mockReleaseBucketsApi: ReleaseBucketsApi = {
  async list() {
    await wait()
    return buckets.map((bucket) => ({ ...bucket }))
  },
  async create(payload) {
    await wait()
    rejectDuplicateName(payload.practice_id, payload.name)
    const created: BucketRecord = { ...payload, id: nextId++ }
    buckets = [...buckets, created]
    return { ...created }
  },
  async update(id, payload) {
    await wait()
    if (!buckets.some((bucket) => bucket.id === id)) {
      throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
    }
    rejectDuplicateName(payload.practice_id, payload.name, id)
    const updated: BucketRecord = { ...payload, id }
    buckets = buckets.map((bucket) => (bucket.id === id ? updated : bucket))
    return { ...updated }
  },
}

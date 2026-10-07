import type { CreateClaimPayload } from '../schemas/claim'
import type { ClaimsApi } from './claims-api'

/**
 * In-memory claims for development and demos (ADR 0006). Never part of a
 * production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the real payload and answers in the
 * assumed wire format (payload + `id`). It checks nothing and calculates
 * nothing — no number, status or amount. One invented claim, made from the
 * visits mock's first visit's first line.
 */
type ClaimRecord = CreateClaimPayload & { id: number }

const LATENCY_MS = 250

let claims: ClaimRecord[] = [
  { id: 1, visit_id: 1, procedure_code_id: '97110', units: 2, modifiers: ['GP'], diagnosis_pointers: [1] },
]
let nextId = 2

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

export const mockClaimsApi: ClaimsApi = {
  async list() {
    await wait()
    return claims.map((claim) => ({ ...claim }))
  },
  async create(payload) {
    await wait()
    const created: ClaimRecord = { ...payload, id: nextId++ }
    claims = [...claims, created]
    return { ...created }
  },
}

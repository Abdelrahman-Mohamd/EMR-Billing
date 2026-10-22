import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import { MAX_PER_PAGE } from '@/lib/api/pagination'
import {
  claimFormFieldFor,
  claimDetailResponseSchema,
  claimPageResponseSchema,
  type Claim,
  type CreateClaimPayload,
  type UpdateClaimPayload,
} from '../schemas/claim'

/**
 * Claims' only door to a server. **Live** (contract given 2026-10-09),
 * carrying the session's token: `GET /claims?page=N`, `POST /claims`,
 * `PUT /claims/{id}`, `DELETE` and `POST /claims/{id}/scrub`. The list is asked for `page` and `per_page=100` (lib/api/pagination.ts). Writes
 * resolve with the server's message. Shapes in schemas/claim.ts.
 */
/**
 * Which claims a list asks for. Left empty: every claim. The server also
 * filters by insurance, the case's insurance and status (`insurance_id`,
 * `case_insurance_id`, `status` — staging, 2026-10-20), not by practice or
 * patient; the Claims list reads them all and filters as it shows them.
 */
export interface ClaimFilter {
  /** A visit's claims (`visit_id`): the visit page's. */
  visitId?: number
}

export interface ClaimsApi {
  list: (
    page: number,
    filter: ClaimFilter,
    signal?: AbortSignal,
  ) => Promise<{ claims: Claim[]; pageCount: number }>
  create: (payload: CreateClaimPayload) => Promise<ServerMessage>
  update: (id: number, payload: UpdateClaimPayload) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
  scrub: (id: number) => Promise<{ message: string | null; claim: Claim }>
}

const path = (id: number) => `/claims/${encodeURIComponent(String(id))}`

const live: ClaimsApi = {
  list: (page, filter, signal) =>
    request({
      method: 'GET',
      path: '/claims',
      searchParams: { page, per_page: MAX_PER_PAGE, visit_id: filter.visitId },
      schema: claimPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  // The answer carries the new claim too; its message is what is shown.
  create: (payload) =>
    request({ method: 'POST', path: '/claims', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
  scrub: (id) => request({ method: 'POST', path: `${path(id)}/scrub`, schema: claimDetailResponseSchema }),
}

function backend(): Promise<ClaimsApi> {
  return Promise.resolve(live)
}

async function send(call: (api: ClaimsApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, claimFormFieldFor)
  }
}

/**
 * Every claim — the Claims list — or a visit's (`filter`). The list is paged by
 * the server, so this reads page 1, then the rest at once.
 */
export async function listClaims(filter: ClaimFilter = {}, signal?: AbortSignal): Promise<Claim[]> {
  const api = await backend()
  const first = await api.list(1, filter, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, filter, signal)),
  )
  return [first, ...rest].flatMap((page) => page.claims)
}

export function createClaim(payload: CreateClaimPayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updateClaim(id: number, payload: UpdateClaimPayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

export function deleteClaim(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

/** Scrubs a claim not yet sent again: the server's message, and the claim as it now stands. */
export async function scrubClaim(id: number): Promise<{ message: string | null; claim: Claim }> {
  return (await backend()).scrub(id)
}

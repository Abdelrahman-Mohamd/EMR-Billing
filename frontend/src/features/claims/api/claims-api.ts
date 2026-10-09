import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  claimFormFieldFor,
  claimPageResponseSchema,
  type Claim,
  type CreateClaimPayload,
  type UpdateClaimPayload,
} from '../schemas/claim'

/**
 * Claims' only door to a server. **Live** (contract given 2026-10-09),
 * carrying the session's token: `GET /claims?page=N`, `POST /claims`,
 * `PUT /claims/{id}` and `DELETE`. Only `page` is sent to the list. Writes
 * resolve with the server's message. Shapes in schemas/claim.ts.
 */
export interface ClaimsApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ claims: Claim[]; pageCount: number }>
  create: (payload: CreateClaimPayload) => Promise<ServerMessage>
  update: (id: number, payload: UpdateClaimPayload) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const path = (id: number) => `/claims/${encodeURIComponent(String(id))}`

const live: ClaimsApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/claims',
      searchParams: { page },
      schema: claimPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  // The answer carries the new claim too; its message is what is shown.
  create: (payload) =>
    request({ method: 'POST', path: '/claims', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
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

/** Every claim. The list is paged by the server, so this reads page 1, then the rest at once. */
export async function listClaims(signal?: AbortSignal): Promise<Claim[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
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

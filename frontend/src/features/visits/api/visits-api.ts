import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  releaseResponseSchema,
  visitDetailResponseSchema,
  visitFormFieldFor,
  visitPageResponseSchema,
  type CreateVisitPayload,
  type ReleaseResult,
  type UpdateVisitPayload,
  type Visit,
} from '../schemas/visit'

/**
 * Visits' only door to a server. **Live** (contract given 2026-10-09),
 * carrying the session's token: `GET /visits?page=N`, `GET /visits/{id}`,
 * `POST /visits`, `PUT /visits/{id}`, `DELETE /visits/{id}` and
 * `POST /visits/{id}/release`. Only `page` is sent to the list. Writes resolve
 * with the server's message; the release with its message and the visit as it
 * now stands. Shapes in schemas/visit.ts.
 *
 * A visit's save refuses its charge lines: they change one at a time, through
 * the charge lines' own door (charge-lines-api.ts).
 */
export interface VisitsApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ visits: Visit[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<Visit>
  create: (payload: CreateVisitPayload) => Promise<ServerMessage>
  update: (id: number, payload: UpdateVisitPayload) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
  release: (id: number) => Promise<ReleaseResult>
}

const path = (id: number) => `/visits/${encodeURIComponent(String(id))}`

const live: VisitsApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/visits',
      searchParams: { page },
      schema: visitPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: path(id),
      schema: visitDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/visits', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
  release: (id) => request({ method: 'POST', path: `${path(id)}/release`, schema: releaseResponseSchema }),
}

function backend(): Promise<VisitsApi> {
  return Promise.resolve(live)
}

async function send<T>(call: (api: VisitsApi) => Promise<T>): Promise<T> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, visitFormFieldFor)
  }
}

/**
 * Every visit — the Visits list, a case's visits on the chart, and Claims. The
 * list is paged by the server, so this reads page 1, then the rest at once.
 */
export async function listVisits(signal?: AbortSignal): Promise<Visit[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.visits)
}

/** One visit, with its billing provider, authorization and each line's code and description. */
export async function getVisit(id: number, signal?: AbortSignal): Promise<Visit> {
  return (await backend()).get(id, signal)
}

export function createVisit(payload: CreateVisitPayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updateVisit(id: number, payload: UpdateVisitPayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

export function deleteVisit(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

/** Releases the visit to be claimed — or the server pends it, and says why. */
export function releaseVisit(id: number): Promise<ReleaseResult> {
  return send((api) => api.release(id))
}

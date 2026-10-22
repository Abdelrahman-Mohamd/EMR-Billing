import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import { MAX_PER_PAGE } from '@/lib/api/pagination'
import type { Coverage } from '../model/coverage'
import {
  caseInsuranceFormFieldFor,
  caseInsurancePageResponseSchema,
  type CaseInsurancePayload,
  type CaseInsuranceUpdatePayload,
  type SubscriberPayload,
} from '../schemas/case-insurance'

/**
 * Case insurances' only door to a server. **Live** (contract given
 * 2026-10-08), carrying the session's token: `GET /case-insurances?page=N`,
 * `POST /case-insurances`, `PUT /case-insurances/{id}` and `DELETE`. The
 * list is asked for `page` and `per_page=100` (lib/api/pagination.ts). Writes resolve with the server's message.
 * Shapes in schemas/case-insurance.ts.
 */
export interface CaseInsurancesApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ coverages: Coverage[]; pageCount: number }>
  create: (payload: CaseInsurancePayload) => Promise<ServerMessage>
  update: (
    id: string,
    payload: CaseInsuranceUpdatePayload | { subscriber: SubscriberPayload | null },
  ) => Promise<ServerMessage>
  remove: (id: string) => Promise<ServerMessage>
}

// The id is the server's, as text; it goes back as it came.
const path = (id: string) => `/case-insurances/${encodeURIComponent(id)}`

const live: CaseInsurancesApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/case-insurances',
      searchParams: { page, per_page: MAX_PER_PAGE },
      schema: caseInsurancePageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/case-insurances', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
}

function backend(): Promise<CaseInsurancesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: CaseInsurancesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, caseInsuranceFormFieldFor)
  }
}

/**
 * Every case's insurances — the chart shows a case's, and Exceptions looks
 * them up by id. The list is paged by the server, so this reads page 1, then
 * the rest at once.
 */
export async function listCaseInsurances(signal?: AbortSignal): Promise<Coverage[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.coverages)
}

export function createCaseInsurance(payload: CaseInsurancePayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updateCaseInsurance(id: string, payload: CaseInsuranceUpdatePayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

/** Exceptions' fix: the subscriber alone. */
export function setCaseInsuranceSubscriber(
  id: string,
  subscriber: SubscriberPayload | null,
): Promise<ServerMessage> {
  return send((api) => api.update(id, { subscriber }))
}

export function deleteCaseInsurance(id: string): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

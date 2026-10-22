import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import { MAX_PER_PAGE } from '@/lib/api/pagination'
import {
  patientCaseFormFieldFor,
  patientCasePageResponseSchema,
  type PatientCaseFieldsPayload,
  type PatientCasePayload,
  type PatientCaseUpdatePayload,
  type ServerCase,
} from '../schemas/patient-case'

/**
 * Patient cases' only door to a server. **Live** (contract given 2026-10-08,
 * not final), carrying the session's token: `GET /patient-cases?page=N`,
 * `POST /patient-cases`, `PUT /patient-cases/{id}` and `DELETE`. The list is asked for `page` and
 * `per_page=100` (lib/api/pagination.ts). Writes resolve with the server's message. Shapes in
 * schemas/patient-case.ts.
 */
export interface PatientCasesApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ cases: ServerCase[]; pageCount: number }>
  create: (payload: PatientCasePayload) => Promise<ServerMessage>
  update: (id: string, payload: PatientCaseUpdatePayload | PatientCaseFieldsPayload) => Promise<ServerMessage>
  remove: (id: string) => Promise<ServerMessage>
}

// The id is the server's, as text; it goes back as it came.
const path = (id: string) => `/patient-cases/${encodeURIComponent(id)}`

const live: PatientCasesApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/patient-cases',
      searchParams: { page, per_page: MAX_PER_PAGE },
      schema: patientCasePageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/patient-cases', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
}

function backend(): Promise<PatientCasesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: PatientCasesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, patientCaseFormFieldFor)
  }
}

/**
 * Every case — the chart shows a patient's, and visits and Exceptions look
 * cases up by id. The list is paged by the server, so this reads page 1, then
 * the rest at once.
 */
export async function listPatientCases(signal?: AbortSignal): Promise<ServerCase[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.cases)
}

export function createPatientCase(payload: PatientCasePayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updatePatientCase(id: string, payload: PatientCaseUpdatePayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

/** Exceptions' fixes: only the fields the fix changes. */
export function updatePatientCaseFields(
  id: string,
  fields: PatientCaseFieldsPayload,
): Promise<ServerMessage> {
  return send((api) => api.update(id, fields))
}

export function deletePatientCase(id: string): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

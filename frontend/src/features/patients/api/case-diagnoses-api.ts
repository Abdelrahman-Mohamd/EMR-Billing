import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  caseDiagnosisFormFieldFor,
  type CaseDiagnosisPayload,
  type CaseDiagnosisUpdatePayload,
} from '../schemas/case-diagnosis'

/**
 * Case diagnoses' only door to a server. **Live** (contract given 2026-10-20),
 * carrying the session's token: `POST /case-diagnoses`, `PUT
 * /case-diagnoses/{id}` and `DELETE`. Writes resolve with the server's message.
 * Nothing reads `GET /case-diagnoses`: every case lists its own. Shapes in
 * schemas/case-diagnosis.ts.
 */
export interface CaseDiagnosesApi {
  create: (payload: CaseDiagnosisPayload) => Promise<ServerMessage>
  update: (id: string, payload: CaseDiagnosisUpdatePayload) => Promise<ServerMessage>
  remove: (id: string) => Promise<ServerMessage>
}

// The id is the server's, as text; it goes back as it came.
const path = (id: string) => `/case-diagnoses/${encodeURIComponent(id)}`

const live: CaseDiagnosesApi = {
  create: (payload) =>
    request({ method: 'POST', path: '/case-diagnoses', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
}

function backend(): Promise<CaseDiagnosesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: CaseDiagnosesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, caseDiagnosisFormFieldFor)
  }
}

export function createCaseDiagnosis(payload: CaseDiagnosisPayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updateCaseDiagnosis(id: string, payload: CaseDiagnosisUpdatePayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

export function deleteCaseDiagnosis(id: string): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

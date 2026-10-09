import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  chargeLineFormFieldFor,
  type ChargeLinePayload,
  type ChargeLineUpdatePayload,
} from '../schemas/charge-line'

/**
 * Charge lines' door to a server. **Live** (contract given 2026-10-09),
 * carrying the session's token: `POST /charge-lines`, `PUT
 * /charge-lines/{id}` and `DELETE`, each resolving with the server's message.
 * The lines themselves are read with their visit (`GET /visits/{id}`). Shapes
 * in schemas/charge-line.ts.
 */
export interface ChargeLinesApi {
  create: (payload: ChargeLinePayload) => Promise<ServerMessage>
  update: (id: number, payload: ChargeLineUpdatePayload) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const path = (id: number) => `/charge-lines/${encodeURIComponent(String(id))}`

const live: ChargeLinesApi = {
  create: (payload) =>
    request({ method: 'POST', path: '/charge-lines', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
}

function backend(): Promise<ChargeLinesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: ChargeLinesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, chargeLineFormFieldFor)
  }
}

export function addChargeLine(payload: ChargeLinePayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updateChargeLine(id: number, payload: ChargeLineUpdatePayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

export function deleteChargeLine(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

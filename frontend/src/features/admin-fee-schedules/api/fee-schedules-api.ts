import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  FEE_ROW_FORM_FIELD_FOR,
  feeRowDetailResponseSchema,
  feeRowPageResponseSchema,
  type FeeRow,
  type FeeRowPayload,
  type FeeRowUpdatePayload,
} from '../schemas/fee-row'
import { toFeeRowPayload, toFeeRowUpdatePayload, type FeeRowFormValues } from '../schemas/fee-row-form'

/**
 * Fee schedules' only door to a server. **Live** (contracts confirmed
 * 2026-10-08), carrying the session's token: `GET /fee-schedules?page=N`,
 * `GET /fee-schedules/{id}`, `POST /fee-schedules`, `PUT /fee-schedules/{id}`
 * and `DELETE`. Only `page` is sent to the list. Writes resolve with the
 * server's message, which the screens show. Shapes in schemas/fee-row.ts.
 */
export interface FeeSchedulesApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ rows: FeeRow[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<FeeRow>
  create: (payload: FeeRowPayload) => Promise<ServerMessage>
  update: (id: number, payload: FeeRowUpdatePayload) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: FeeSchedulesApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/fee-schedules',
      searchParams: { page },
      schema: feeRowPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/fee-schedules/${id}`,
      schema: feeRowDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/fee-schedules', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/fee-schedules/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: `/fee-schedules/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<FeeSchedulesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: FeeSchedulesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, FEE_ROW_FORM_FIELD_FOR)
  }
}

/**
 * Every row — the screen shows one insurance's at a time and the price lookup
 * reads them all. The list is paged by the server, so this reads page 1, then
 * the rest at once.
 */
export async function listFeeRows(signal?: AbortSignal): Promise<FeeRow[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.rows)
}

export async function getFeeRow(id: number, signal?: AbortSignal): Promise<FeeRow> {
  return (await backend()).get(id, signal)
}

export function createFeeRow(insuranceId: number, values: FeeRowFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toFeeRowPayload(insuranceId, values)))
}

export function updateFeeRow(id: number, values: FeeRowFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toFeeRowUpdatePayload(values)))
}

export function deleteFeeRow(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

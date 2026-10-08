import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  procedureCodeDetailResponseSchema,
  procedureCodeFormFieldFor,
  procedureCodePageResponseSchema,
  type ProcedureCode,
  type ProcedureCodePayload,
} from '../schemas/procedure-code'
import { toProcedureCodePayload, type ProcedureCodeFormValues } from '../schemas/procedure-code-form'

/**
 * Procedure codes' only door to a server. **Live** (contracts confirmed
 * 2026-10-08), carrying the session's token: `GET /procedure-codes?page=N`,
 * `GET /procedure-codes/{id}`, `POST /procedure-codes`,
 * `PUT /procedure-codes/{id}` and `DELETE`. Only `page` is sent to the list.
 * Writes resolve with the server's message, which the screens show. Shapes in
 * schemas/procedure-code.ts.
 */
export interface ProcedureCodesApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ codes: ProcedureCode[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<ProcedureCode>
  create: (payload: ProcedureCodePayload) => Promise<ServerMessage>
  update: (
    id: number,
    payload: ProcedureCodePayload | { is_active: boolean } | { default_fee: number },
  ) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: ProcedureCodesApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/procedure-codes',
      searchParams: { page },
      schema: procedureCodePageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/procedure-codes/${id}`,
      schema: procedureCodeDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/procedure-codes', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/procedure-codes/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: `/procedure-codes/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<ProcedureCodesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: ProcedureCodesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, procedureCodeFormFieldFor)
  }
}

/**
 * Every code — the list is shared by every practice, sorted and paged on the
 * screen as the prototype does, and fee schedules, coding rules, visits and
 * Exceptions look codes up in it. The server pages it, so this reads page 1,
 * then the rest at once.
 */
export async function listProcedureCodes(signal?: AbortSignal): Promise<ProcedureCode[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.codes)
}

export async function getProcedureCode(id: number, signal?: AbortSignal): Promise<ProcedureCode> {
  return (await backend()).get(id, signal)
}

export function createProcedureCode(values: ProcedureCodeFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toProcedureCodePayload(values)))
}

export function updateProcedureCode(id: number, values: ProcedureCodeFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toProcedureCodePayload(values)))
}

/** Activates or deactivates a code: a save carrying `is_active` alone. */
export function setProcedureCodeActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

/** Sets a code's default fee alone — the Exceptions fix; nothing else changes. */
export function setProcedureCodeDefaultFee(id: number, defaultFee: number): Promise<ServerMessage> {
  return send((api) => api.update(id, { default_fee: defaultFee }))
}

export function deleteProcedureCode(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

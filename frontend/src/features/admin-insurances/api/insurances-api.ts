import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  INSURANCE_FORM_FIELD_FOR,
  insuranceDetailResponseSchema,
  insurancePageResponseSchema,
  toInsurancePayload,
  toInsuranceUpdatePayload,
  type Insurance,
  type InsuranceDetail,
  type InsuranceFormValues,
  type InsurancePayload,
  type InsuranceUpdatePayload,
} from '../schemas/insurance'

/**
 * Insurances' only door to a server. **Live** (contracts confirmed
 * 2026-10-08), carrying the session's token: `GET /insurances?page=N`,
 * `GET /insurances/{id}`, `POST /insurances`, `PUT /insurances/{id}` and
 * `DELETE /insurances/{id}`. Only `page` is sent to the list. Writes resolve
 * with the server's message, which the screens show. Shapes in
 * schemas/insurance.ts.
 *
 * A portal password is passed straight through: never logged, stored or
 * cached.
 */
export interface InsurancesApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ insurances: Insurance[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<InsuranceDetail>
  create: (payload: InsurancePayload) => Promise<ServerMessage>
  update: (id: number, payload: InsuranceUpdatePayload | { is_active: boolean }) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: InsurancesApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/insurances',
      searchParams: { page },
      schema: insurancePageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/insurances/${id}`,
      schema: insuranceDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/insurances', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/insurances/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: `/insurances/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<InsurancesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: InsurancesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, INSURANCE_FORM_FIELD_FOR)
  }
}

/**
 * Every insurance — this screen filters them by practice, and patients,
 * providers, coding rules and fee schedules pick and name them. The list is
 * paged by the server, so this reads page 1, then the rest at once.
 */
export async function listInsurances(signal?: AbortSignal): Promise<Insurance[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.insurances)
}

export async function getInsurance(id: number, signal?: AbortSignal): Promise<InsuranceDetail> {
  return (await backend()).get(id, signal)
}

export function createInsurance(values: InsuranceFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toInsurancePayload(values)))
}

export function updateInsurance(id: number, values: InsuranceFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toInsuranceUpdatePayload(values)))
}

/** Activates or deactivates an insurance: a save carrying `is_active` alone. */
export function setInsuranceActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

export function deleteInsurance(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

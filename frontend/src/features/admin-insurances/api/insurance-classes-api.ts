import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  INSURANCE_CLASS_FORM_FIELD_FOR,
  insuranceClassDetailResponseSchema,
  insuranceClassPageResponseSchema,
  toInsuranceClassPayload,
  toInsuranceClassUpdatePayload,
  type InsuranceClass,
  type InsuranceClassFormValues,
  type InsuranceClassPayload,
  type InsuranceClassUpdatePayload,
} from '../schemas/insurance-class'

/**
 * Insurance classes' only door to a server. **Live** (contracts confirmed
 * 2026-10-07), carrying the session's token: `GET /insurance-classes?page=N`,
 * `GET /insurance-classes/{id}`, `POST /insurance-classes`,
 * `PUT /insurance-classes/{id}` and `DELETE /insurance-classes/{id}`. Only
 * `page` is sent to the list. Writes resolve with the server's message, which
 * the screens show. Shapes in schemas/insurance-class.ts.
 */
export interface InsuranceClassesApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ classes: InsuranceClass[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<InsuranceClass>
  create: (payload: InsuranceClassPayload) => Promise<ServerMessage>
  update: (
    id: number,
    payload: InsuranceClassUpdatePayload | { is_active: boolean },
  ) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: InsuranceClassesApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/insurance-classes',
      searchParams: { page },
      schema: insuranceClassPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/insurance-classes/${id}`,
      schema: insuranceClassDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/insurance-classes', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/insurance-classes/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) =>
    request({ method: 'DELETE', path: `/insurance-classes/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<InsuranceClassesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: InsuranceClassesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, INSURANCE_CLASS_FORM_FIELD_FOR)
  }
}

/**
 * Every class — this screen filters them by practice, and Insurances and
 * Coding rules name and pick them. The list is paged by the server, so this
 * reads page 1, then the rest at once; a practice has a handful of classes.
 */
export async function listInsuranceClasses(signal?: AbortSignal): Promise<InsuranceClass[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.classes)
}

export async function getInsuranceClass(id: number, signal?: AbortSignal): Promise<InsuranceClass> {
  return (await backend()).get(id, signal)
}

export function createInsuranceClass(values: InsuranceClassFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toInsuranceClassPayload(values)))
}

export function updateInsuranceClass(id: number, values: InsuranceClassFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toInsuranceClassUpdatePayload(values)))
}

/** Activates or deactivates a class: a save carrying `is_active` alone. */
export function setInsuranceClassActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

export function deleteInsuranceClass(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

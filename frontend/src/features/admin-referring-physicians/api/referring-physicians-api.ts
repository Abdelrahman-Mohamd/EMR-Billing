import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import { MAX_PER_PAGE } from '@/lib/api/pagination'
import {
  REFERRING_PHYSICIAN_FORM_FIELD_FOR,
  referringPhysicianDetailResponseSchema,
  referringPhysicianPageResponseSchema,
  toReferringPhysicianPayload,
  toReferringPhysicianUpdatePayload,
  type ReferringPhysician,
  type ReferringPhysicianFormValues,
  type ReferringPhysicianPayload,
  type ReferringPhysicianUpdatePayload,
} from '../schemas/referring-physician'

/**
 * Referring physicians' only door to a server. **Live** (contracts confirmed
 * 2026-10-08), carrying the session's token: `GET /referring-physicians?page=N`,
 * `GET /referring-physicians/{id}`, `POST`, `PUT /referring-physicians/{id}`
 * and `DELETE`. The list is asked for `page` and `per_page=100` (lib/api/pagination.ts). Writes resolve with the
 * server's message, which the screens show. Shapes in
 * schemas/referring-physician.ts.
 */
export interface ReferringPhysiciansApi {
  list: (
    page: number,
    signal?: AbortSignal,
  ) => Promise<{ physicians: ReferringPhysician[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<ReferringPhysician>
  create: (payload: ReferringPhysicianPayload) => Promise<ServerMessage>
  update: (
    id: number,
    payload: ReferringPhysicianUpdatePayload | { is_active: boolean } | { npi: string },
  ) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: ReferringPhysiciansApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/referring-physicians',
      searchParams: { page, per_page: MAX_PER_PAGE },
      schema: referringPhysicianPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/referring-physicians/${id}`,
      schema: referringPhysicianDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/referring-physicians', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({
      method: 'PUT',
      path: `/referring-physicians/${id}`,
      body: payload,
      schema: serverMessageSchema,
    }),
  remove: (id) =>
    request({ method: 'DELETE', path: `/referring-physicians/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<ReferringPhysiciansApi> {
  return Promise.resolve(live)
}

async function send(call: (api: ReferringPhysiciansApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, REFERRING_PHYSICIAN_FORM_FIELD_FOR)
  }
}

/**
 * Every physician — this screen filters them by practice, and a patient's case
 * picks one. The list is paged by the server, so this reads page 1, then the
 * rest at once.
 */
export async function listReferringPhysicians(signal?: AbortSignal): Promise<ReferringPhysician[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.physicians)
}

export async function getReferringPhysician(id: number, signal?: AbortSignal): Promise<ReferringPhysician> {
  return (await backend()).get(id, signal)
}

export function createReferringPhysician(values: ReferringPhysicianFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toReferringPhysicianPayload(values)))
}

export function updateReferringPhysician(
  id: number,
  values: ReferringPhysicianFormValues,
): Promise<ServerMessage> {
  return send((api) => api.update(id, toReferringPhysicianUpdatePayload(values)))
}

/** Activates or deactivates a physician: a save carrying `is_active` alone. */
export function setReferringPhysicianActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

/** Corrects a physician's NPI alone — the Exceptions fix; nothing else changes. */
export function correctReferringPhysicianNpi(id: number, npi: string): Promise<ServerMessage> {
  return send((api) => api.update(id, { npi }))
}

export function deleteReferringPhysician(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

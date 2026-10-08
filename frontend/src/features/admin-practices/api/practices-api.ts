import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import type { LocationFormValues, NewPracticeFormValues, PracticeFormValues } from '../schemas/practice-form'
import type { LocationPayload, LocationUpdatePayload, PracticePayload } from '../schemas/practice-payload'
import {
  locationPageResponseSchema,
  practiceDetailResponseSchema,
  practicePageResponseSchema,
  type LocationSummary,
  type Practice,
  type PracticePage,
  type PracticeSummary,
} from '../schemas/practice'
import {
  locationFormFieldFor,
  practiceFormFieldFor,
  toLocationPayload,
  toLocationUpdatePayload,
  toPracticePayload,
} from './payloads'

/**
 * Practices & Locations' only door to a server. Every call carries the
 * session's token. All confirmed 2026-10-07 and tried on staging:
 *
 * - `GET /practices?page=N` — the list, paged by the server, as summaries (no
 *   address, no locations). Only `page` is sent.
 * - `GET /practices/{id}` — one practice in full, with its locations.
 * - `POST /practices` — the practice with its first location in
 *   `locations[]`. `PUT /practices/{id}` — the practice without `locations`
 *   (they stay as they are). `DELETE /practices/{id}` — its locations go with
 *   it.
 * - `GET /locations?page=N` — every location, as summaries (no address).
 * - `POST /locations` — one location with its `practice_id`.
 *   `PUT /locations/{id}` — without `practice_id` (refused: a location never
 *   moves practice). `DELETE /locations/{id}`.
 *
 * Writes answer `{ success, message, data: null }`: each resolves with the
 * server's message, which the screens show (lib/api/server-message.ts). A `PUT` changes only the fields it carries (see
 * schemas/practice-payload.ts). `GET /locations/{id}` exists too; nothing here
 * needs it, since a practice comes with its locations in full.
 */
export interface PracticesApi {
  listPractices: (page: number, signal?: AbortSignal) => Promise<PracticePage>
  getPractice: (id: number, signal?: AbortSignal) => Promise<Practice>
  createPractice: (payload: PracticePayload) => Promise<ServerMessage>
  updatePractice: (id: number, payload: PracticePayload) => Promise<ServerMessage>
  deletePractice: (id: number) => Promise<ServerMessage>
  listLocations: (
    page: number,
    signal?: AbortSignal,
  ) => Promise<{ locations: LocationSummary[]; pageCount: number }>
  createLocation: (payload: LocationPayload) => Promise<ServerMessage>
  updateLocation: (
    id: number,
    payload: LocationUpdatePayload | { is_active: boolean },
  ) => Promise<ServerMessage>
  deleteLocation: (id: number) => Promise<ServerMessage>
}

const live: PracticesApi = {
  listPractices: (page, signal) =>
    request({
      method: 'GET',
      path: '/practices',
      searchParams: { page },
      schema: practicePageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  getPractice: (id, signal) =>
    request({
      method: 'GET',
      path: `/practices/${id}`,
      schema: practiceDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  createPractice: (payload) =>
    request({ method: 'POST', path: '/practices', body: payload, schema: serverMessageSchema }),
  updatePractice: (id, payload) =>
    request({ method: 'PUT', path: `/practices/${id}`, body: payload, schema: serverMessageSchema }),
  deletePractice: (id) =>
    request({ method: 'DELETE', path: `/practices/${id}`, schema: serverMessageSchema }),
  listLocations: (page, signal) =>
    request({
      method: 'GET',
      path: '/locations',
      searchParams: { page },
      schema: locationPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  createLocation: (payload) =>
    request({ method: 'POST', path: '/locations', body: payload, schema: serverMessageSchema }),
  updateLocation: (id, payload) =>
    request({ method: 'PUT', path: `/locations/${id}`, body: payload, schema: serverMessageSchema }),
  deleteLocation: (id) =>
    request({ method: 'DELETE', path: `/locations/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<PracticesApi> {
  return Promise.resolve(live)
}

/** Every page of a server-paged list: page 1, then the rest at once. */
async function everyPage<T>(
  read: (page: number) => Promise<{ items: T[]; pageCount: number }>,
): Promise<T[]> {
  const first = await read(1)
  const rest = await Promise.all(Array.from({ length: first.pageCount - 1 }, (_, index) => read(index + 2)))
  return [first, ...rest].flatMap((page) => page.items)
}

/**
 * Every practice, as summaries — for the picker here and the practice
 * selects and name lookups elsewhere. Practices are a handful of pages at
 * most.
 */
export async function listPractices(signal?: AbortSignal): Promise<PracticeSummary[]> {
  const api = await backend()
  return everyPage(async (page) => {
    const result = await api.listPractices(page, signal)
    return { items: result.practices, pageCount: result.pageCount }
  })
}

/** One practice in full, with its locations. */
export async function getPractice(id: number, signal?: AbortSignal): Promise<Practice> {
  return (await backend()).getPractice(id, signal)
}

/**
 * Every location of every practice, as summaries (no address) — to pick or
 * name a location elsewhere in the app (visits, provider holds).
 */
export async function listLocations(signal?: AbortSignal): Promise<LocationSummary[]> {
  const api = await backend()
  return everyPage(async (page) => {
    const result = await api.listLocations(page, signal)
    return { items: result.locations, pageCount: result.pageCount }
  })
}

/** The server names payload fields; the forms name and nest theirs their own way. */
async function send(
  call: (api: PracticesApi) => Promise<ServerMessage>,
  fieldFor: (path: string) => string,
): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, fieldFor)
  }
}

/** Creates a practice with its first location. */
export function createPractice(values: NewPracticeFormValues): Promise<ServerMessage> {
  return send((api) => api.createPractice(toPracticePayload(values)), practiceFormFieldFor)
}

export function updatePractice(id: number, values: PracticeFormValues): Promise<ServerMessage> {
  return send((api) => api.updatePractice(id, toPracticePayload(values)), practiceFormFieldFor)
}

export function deletePractice(id: number): Promise<ServerMessage> {
  return send((api) => api.deletePractice(id), practiceFormFieldFor)
}

export function createLocation(practiceId: number, values: LocationFormValues): Promise<ServerMessage> {
  return send((api) => api.createLocation(toLocationPayload(practiceId, values)), locationFormFieldFor)
}

export function updateLocation(id: number, values: LocationFormValues): Promise<ServerMessage> {
  return send((api) => api.updateLocation(id, toLocationUpdatePayload(values)), locationFormFieldFor)
}

/** Activates or deactivates a location: a save carrying `is_active` alone. */
export function setLocationActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.updateLocation(id, { is_active: isActive }), locationFormFieldFor)
}

export function deleteLocation(id: number): Promise<ServerMessage> {
  return send((api) => api.deleteLocation(id), locationFormFieldFor)
}

import { z } from 'zod'
import { ApiError } from '@/lib/api/api-error'
import type { LocationFormValues, NewPracticeFormValues, PracticeFormValues } from '../schemas/practice-form'
import type { LocationPayload, PracticePayload } from '../schemas/practice-payload'
import {
  locationResponseSchema,
  practiceResponseSchema,
  type Location,
  type Practice,
} from '../schemas/practice'
import { toLocationPayload, toPracticePayload } from './payloads'

/**
 * Practices & Locations' only door to a server.
 *
 * **No endpoints exist yet.** The request bodies are known (the practice and
 * location payloads); paths, methods and response bodies are not, so none are
 * written here. In development and tests the calls go to an in-memory mock
 * that plays the server — it receives the real payloads and answers in wire
 * format — so the mapping on the way out and the parsing on the way back run
 * exactly as they will against the backend (ADR 0006). In any other build they
 * reject as `unavailable`.
 *
 * Assumed until the contract says otherwise: practices are read as one list,
 * each with its locations; a location is created and saved on its own (the
 * standalone location payload); editing a practice does not send its
 * locations.
 */
export interface PracticesApi {
  listPractices: (signal?: AbortSignal) => Promise<unknown>
  createPractice: (payload: PracticePayload) => Promise<unknown>
  updatePractice: (id: number, payload: PracticePayload) => Promise<unknown>
  createLocation: (payload: LocationPayload) => Promise<unknown>
  updateLocation: (id: number, payload: LocationPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Practices are not available right now.',
      detail:
        'No practice or location endpoints exist yet. features/admin-practices/api/practices-api.ts is the integration point.',
    }),
  )

const live: PracticesApi = {
  listPractices: notConnected,
  createPractice: notConnected,
  updatePractice: notConnected,
  createLocation: notConnected,
  updateLocation: notConnected,
}

async function backend(): Promise<PracticesApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./practices-api.mock')).mockPracticesApi
  return live
}

export async function listPractices(signal?: AbortSignal): Promise<Practice[]> {
  return z.array(practiceResponseSchema).parse(await (await backend()).listPractices(signal))
}

export async function createPractice(values: NewPracticeFormValues): Promise<Practice> {
  return practiceResponseSchema.parse(await (await backend()).createPractice(toPracticePayload(values)))
}

export async function updatePractice(id: number, values: PracticeFormValues): Promise<Practice> {
  return practiceResponseSchema.parse(await (await backend()).updatePractice(id, toPracticePayload(values)))
}

export async function createLocation(practiceId: number, values: LocationFormValues): Promise<Location> {
  return locationResponseSchema.parse(
    await (await backend()).createLocation(toLocationPayload(practiceId, values)),
  )
}

export async function updateLocation(
  id: number,
  practiceId: number,
  values: LocationFormValues,
): Promise<Location> {
  return locationResponseSchema.parse(
    await (await backend()).updateLocation(id, toLocationPayload(practiceId, values)),
  )
}

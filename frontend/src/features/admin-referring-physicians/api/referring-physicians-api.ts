import { z } from 'zod'
import { ApiError } from '@/lib/api/api-error'
import {
  referringPhysicianResponseSchema,
  toReferringPhysicianPayload,
  type ReferringPhysician,
  type ReferringPhysicianFormValues,
  type ReferringPhysicianPayload,
} from '../schemas/referring-physician'

/**
 * Referring physicians' only door to a server.
 *
 * **No endpoints exist yet.** The request body is known (the referring
 * physician payload); paths, methods and responses are not, so none are
 * written. In development and tests the calls go to an in-memory mock that
 * plays the server (ADR 0006); in any other build they reject as
 * `unavailable`.
 *
 * Assumed until the contract says otherwise: one list of every physician the
 * user can see, filtered on screen; create and update, and nothing else — the
 * prototype offers no delete, so none is built.
 */
export interface ReferringPhysiciansApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: ReferringPhysicianPayload) => Promise<unknown>
  update: (id: number, payload: ReferringPhysicianPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Referring physicians are not available right now.',
      detail:
        'No referring physician endpoints exist yet. features/admin-referring-physicians/api/referring-physicians-api.ts is the integration point.',
    }),
  )

const live: ReferringPhysiciansApi = { list: notConnected, create: notConnected, update: notConnected }

async function backend(): Promise<ReferringPhysiciansApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./referring-physicians-api.mock')).mockReferringPhysiciansApi
  return live
}

export async function listReferringPhysicians(signal?: AbortSignal): Promise<ReferringPhysician[]> {
  return z.array(referringPhysicianResponseSchema).parse(await (await backend()).list(signal))
}

export async function createReferringPhysician(
  values: ReferringPhysicianFormValues,
): Promise<ReferringPhysician> {
  return referringPhysicianResponseSchema.parse(
    await (await backend()).create(toReferringPhysicianPayload(values)),
  )
}

export async function updateReferringPhysician(
  id: number,
  values: ReferringPhysicianFormValues,
): Promise<ReferringPhysician> {
  return referringPhysicianResponseSchema.parse(
    await (await backend()).update(id, toReferringPhysicianPayload(values)),
  )
}

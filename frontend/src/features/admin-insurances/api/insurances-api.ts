import { z } from 'zod'
import { ApiError, renameFieldErrors } from '@/lib/api/api-error'
import {
  INSURANCE_FORM_FIELD_FOR,
  insuranceResponseSchema,
  toInsurancePayload,
  type Insurance,
  type InsuranceFormValues,
  type InsurancePayload,
} from '../schemas/insurance'

/**
 * Insurances' only door to a server.
 *
 * **No endpoints and no payload exist yet.** The body sent is provisional
 * (see `schemas/insurance.ts`); paths, methods and responses are not known, so
 * none are written. In development and tests the calls go to an in-memory
 * mock that plays the server (ADR 0006); in any other build they reject as
 * `unavailable`.
 *
 * Assumed until the contract says otherwise: one list of every insurance the
 * user can see, filtered on screen; create and update, and nothing else — the
 * prototype deactivates an insurance and offers no delete, so none is built.
 */
export interface InsurancesApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: InsurancePayload) => Promise<unknown>
  update: (id: number, payload: InsurancePayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Insurances are not available right now.',
      detail:
        'No insurance endpoints exist yet. features/admin-insurances/api/insurances-api.ts is the integration point.',
    }),
  )

const live: InsurancesApi = { list: notConnected, create: notConnected, update: notConnected }

async function backend(): Promise<InsurancesApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./insurances-api.mock')).mockInsurancesApi
  return live
}

async function save(call: (api: InsurancesApi) => Promise<unknown>): Promise<Insurance> {
  try {
    return insuranceResponseSchema.parse(await call(await backend()))
  } catch (error) {
    throw renameFieldErrors(error, INSURANCE_FORM_FIELD_FOR)
  }
}

export async function listInsurances(signal?: AbortSignal): Promise<Insurance[]> {
  return z.array(insuranceResponseSchema).parse(await (await backend()).list(signal))
}

export function createInsurance(values: InsuranceFormValues): Promise<Insurance> {
  return save((api) => api.create(toInsurancePayload(values)))
}

export function updateInsurance(id: number, values: InsuranceFormValues): Promise<Insurance> {
  return save((api) => api.update(id, toInsurancePayload(values)))
}

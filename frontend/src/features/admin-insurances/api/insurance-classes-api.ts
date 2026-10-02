import { z } from 'zod'
import { ApiError, renameFieldErrors } from '@/lib/api/api-error'
import {
  INSURANCE_CLASS_FORM_FIELD_FOR,
  insuranceClassResponseSchema,
  toInsuranceClassPayload,
  type InsuranceClass,
  type InsuranceClassFormValues,
  type InsuranceClassPayload,
} from '../schemas/insurance-class'

/**
 * Insurance classes' only door to a server.
 *
 * **No endpoints and no payload exist yet.** The body sent is provisional
 * (see `schemas/insurance-class.ts`); paths, methods and responses are not
 * known, so none are written. In development and tests the calls go to an
 * in-memory mock that plays the server (ADR 0006); in any other build they
 * reject as `unavailable`.
 *
 * Assumed until the contract says otherwise: one list of every class the user
 * can see, filtered on screen; create and update, and nothing else — the
 * prototype deactivates a class and offers no delete, so none is built.
 */
export interface InsuranceClassesApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: InsuranceClassPayload) => Promise<unknown>
  update: (id: number, payload: InsuranceClassPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Insurance classes are not available right now.',
      detail:
        'No insurance class endpoints exist yet. features/admin-insurances/api/insurance-classes-api.ts is the integration point.',
    }),
  )

const live: InsuranceClassesApi = { list: notConnected, create: notConnected, update: notConnected }

async function backend(): Promise<InsuranceClassesApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./insurance-classes-api.mock')).mockInsuranceClassesApi
  return live
}

async function save(call: (api: InsuranceClassesApi) => Promise<unknown>): Promise<InsuranceClass> {
  try {
    return insuranceClassResponseSchema.parse(await call(await backend()))
  } catch (error) {
    throw renameFieldErrors(error, INSURANCE_CLASS_FORM_FIELD_FOR)
  }
}

export async function listInsuranceClasses(signal?: AbortSignal): Promise<InsuranceClass[]> {
  return z.array(insuranceClassResponseSchema).parse(await (await backend()).list(signal))
}

export function createInsuranceClass(values: InsuranceClassFormValues): Promise<InsuranceClass> {
  return save((api) => api.create(toInsuranceClassPayload(values)))
}

export function updateInsuranceClass(id: number, values: InsuranceClassFormValues): Promise<InsuranceClass> {
  return save((api) => api.update(id, toInsuranceClassPayload(values)))
}

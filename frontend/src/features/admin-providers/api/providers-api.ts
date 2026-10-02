import { z } from 'zod'
import { ApiError, renameFieldErrors } from '@/lib/api/api-error'
import {
  PROVIDER_FORM_FIELD_FOR,
  providerResponseSchema,
  toProviderPayload,
  type Provider,
  type ProviderFormValues,
  type ProviderPayload,
} from '../schemas/provider'

/**
 * Providers' only door to a server.
 *
 * **No endpoints and no payload exist yet.** The body sent is provisional
 * (see `schemas/provider.ts`); paths, methods and responses are not known, so
 * none are written. In development and tests the calls go to an in-memory
 * mock that plays the server (ADR 0006); in any other build they reject as
 * `unavailable`.
 *
 * The claim hold travels with the provider, as the prototype saves it in the
 * same form; whether the backend wants it as part of the provider or as its
 * own resource is not known, and this file is where that would change.
 *
 * Assumed until the contract says otherwise: one list of every provider the
 * user can see, filtered on screen; create and update, and nothing else — the
 * prototype deactivates a provider and offers no delete, so none is built.
 */
export interface ProvidersApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: ProviderPayload) => Promise<unknown>
  update: (id: number, payload: ProviderPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Providers are not available right now.',
      detail:
        'No provider endpoints exist yet. features/admin-providers/api/providers-api.ts is the integration point.',
    }),
  )

const live: ProvidersApi = { list: notConnected, create: notConnected, update: notConnected }

async function backend(): Promise<ProvidersApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./providers-api.mock')).mockProvidersApi
  return live
}

async function save(call: (api: ProvidersApi) => Promise<unknown>): Promise<Provider> {
  try {
    return providerResponseSchema.parse(await call(await backend()))
  } catch (error) {
    throw renameFieldErrors(error, PROVIDER_FORM_FIELD_FOR)
  }
}

export async function listProviders(signal?: AbortSignal): Promise<Provider[]> {
  return z.array(providerResponseSchema).parse(await (await backend()).list(signal))
}

export function createProvider(values: ProviderFormValues): Promise<Provider> {
  return save((api) => api.create(toProviderPayload(values)))
}

export function updateProvider(id: number, values: ProviderFormValues): Promise<Provider> {
  return save((api) => api.update(id, toProviderPayload(values)))
}

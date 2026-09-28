import { z } from 'zod'
import { ApiError } from '@/lib/api/api-error'
import {
  organizationResponseSchema,
  toOrganizationPayload,
  type Organization,
  type OrganizationFormValues,
  type OrganizationPayload,
} from '../schemas/organization'

/**
 * The organizations feature's only door to a server.
 *
 * **No endpoints exist yet.** The request body is known (the organization
 * payload); paths, methods and response bodies are not, so none are written
 * here. In development and tests the calls go to an in-memory mock that plays
 * the server — it receives the real payload and answers in wire format — so
 * the payload mapping and the response parsing below run exactly as they will
 * against the real backend (ADR 0006). In any other build they reject as
 * `unavailable`, and the screen shows its error state.
 *
 * When the endpoints land, `live` becomes three `request()` calls; nothing
 * outside this file changes.
 */
export interface OrganizationsApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: OrganizationPayload) => Promise<unknown>
  update: (id: number, payload: OrganizationPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Organizations are not available right now.',
      detail:
        'No organizations endpoints exist yet. features/admin-organizations/api/organizations-api.ts is the integration point.',
    }),
  )

const live: OrganizationsApi = {
  list: notConnected,
  create: notConnected,
  update: notConnected,
}

async function backend(): Promise<OrganizationsApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./organizations-api.mock')).mockOrganizationsApi
  return live
}

export async function listOrganizations(signal?: AbortSignal): Promise<Organization[]> {
  return z.array(organizationResponseSchema).parse(await (await backend()).list(signal))
}

export async function createOrganization(values: OrganizationFormValues): Promise<Organization> {
  return organizationResponseSchema.parse(await (await backend()).create(toOrganizationPayload(values)))
}

export async function updateOrganization(id: number, values: OrganizationFormValues): Promise<Organization> {
  return organizationResponseSchema.parse(await (await backend()).update(id, toOrganizationPayload(values)))
}

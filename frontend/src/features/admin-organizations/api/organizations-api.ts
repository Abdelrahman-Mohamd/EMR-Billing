import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  organizationDetailResponseSchema,
  organizationPageResponseSchema,
  toOrganizationPayload,
  type Organization,
  type OrganizationDetail,
  type OrganizationFormValues,
  type OrganizationPage,
  type OrganizationPayload,
} from '../schemas/organization'

/**
 * The organizations feature's only door to a server.
 *
 * **Live** (contracts confirmed 2026-10-07), carrying the session's token:
 * `GET /organizations?page=N` (15 a page), `GET /organizations/{id}`,
 * `POST /organizations`, `PUT /organizations/{id}` and
 * `DELETE /organizations/{id}`. Only `page` is sent to the list: no search,
 * filter or sort parameter is part of the contract. Create, update and delete
 * answer no record — each resolves with the server's message, which the
 * screens show (lib/api/server-message.ts). Shapes in schemas/organization.ts.
 *
 * With no backend configured (the tests), the calls reject as `unavailable`
 * without being sent.
 */
export interface OrganizationsApi {
  list: (page: number, signal?: AbortSignal) => Promise<OrganizationPage>
  get: (id: number, signal?: AbortSignal) => Promise<OrganizationDetail>
  create: (payload: OrganizationPayload) => Promise<ServerMessage>
  update: (id: number, payload: OrganizationPayload) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: OrganizationsApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/organizations',
      searchParams: { page },
      schema: organizationPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/organizations/${id}`,
      schema: organizationDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/organizations', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/organizations/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: `/organizations/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<OrganizationsApi> {
  return Promise.resolve(live)
}

export async function listOrganizations(page: number, signal?: AbortSignal): Promise<OrganizationPage> {
  return (await backend()).list(page, signal)
}

/**
 * Every organization, for a picker or a name lookup elsewhere (a practice's
 * organization). The list is paged by the server, so this reads page 1, then
 * the rest at once. Organizations are owner groups — a handful of pages at
 * most.
 */
export async function listAllOrganizations(signal?: AbortSignal): Promise<Organization[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.organizations)
}

export async function getOrganization(id: number, signal?: AbortSignal): Promise<OrganizationDetail> {
  return (await backend()).get(id, signal)
}

export async function createOrganization(values: OrganizationFormValues): Promise<ServerMessage> {
  return (await backend()).create(toOrganizationPayload(values))
}

export async function updateOrganization(id: number, values: OrganizationFormValues): Promise<ServerMessage> {
  return (await backend()).update(id, toOrganizationPayload(values))
}

export async function deleteOrganization(id: number): Promise<ServerMessage> {
  return (await backend()).remove(id)
}

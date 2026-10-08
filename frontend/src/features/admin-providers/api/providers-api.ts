import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  PROVIDER_FORM_FIELD_FOR,
  providerDetailResponseSchema,
  providerPageResponseSchema,
  toProviderPayload,
  toProviderUpdatePayload,
  type Provider,
  type ProviderFormValues,
  type ProviderPayload,
  type ProviderUpdatePayload,
} from '../schemas/provider'

/**
 * Providers' only door to a server. **Live** (contracts confirmed 2026-10-08),
 * carrying the session's token: `GET /providers?page=N`, `GET /providers/{id}`,
 * `POST /providers`, `PUT /providers/{id}` and `DELETE`. Only `page` is sent
 * to the list. Writes resolve with the server's message, which the screens
 * show. Shapes in schemas/provider.ts.
 */
export interface ProvidersApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ providers: Provider[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<Provider>
  create: (payload: ProviderPayload) => Promise<ServerMessage>
  update: (
    id: number,
    payload: ProviderUpdatePayload | { is_active: boolean } | { npi: string },
  ) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: ProvidersApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/providers',
      searchParams: { page },
      schema: providerPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/providers/${id}`,
      schema: providerDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/providers', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/providers/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: `/providers/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<ProvidersApi> {
  return Promise.resolve(live)
}

async function send(call: (api: ProvidersApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, PROVIDER_FORM_FIELD_FOR)
  }
}

/**
 * Every provider — this screen filters them by practice, and visits and
 * Exceptions look providers up by id. The list is paged by the server, so this
 * reads page 1, then the rest at once.
 */
export async function listProviders(signal?: AbortSignal): Promise<Provider[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.providers)
}

export async function getProvider(id: number, signal?: AbortSignal): Promise<Provider> {
  return (await backend()).get(id, signal)
}

export function createProvider(values: ProviderFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toProviderPayload(values)))
}

export function updateProvider(id: number, values: ProviderFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toProviderUpdatePayload(values)))
}

/** Activates or deactivates a provider: a save carrying `is_active` alone. */
export function setProviderActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

/** Corrects a provider's NPI alone — the Exceptions fix; nothing else changes. */
export function correctProviderNpi(id: number, npi: string): Promise<ServerMessage> {
  return send((api) => api.update(id, { npi }))
}

export function deleteProvider(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  authorizationFormFieldFor,
  authorizationPageResponseSchema,
  type AuthorizationPayload,
  type AuthorizationUpdatePayload,
  type ServerAuthorization,
} from '../schemas/authorization'

/**
 * Authorizations' only door to a server. **Live** (contract given
 * 2026-10-09), carrying the session's token: `GET /authorizations?page=N`,
 * `POST /authorizations`, `PUT /authorizations/{id}` and `DELETE`. Only `page`
 * is sent to the list. Writes resolve with the server's message. Shapes in
 * schemas/authorization.ts.
 */
export interface AuthorizationsApi {
  list: (
    page: number,
    signal?: AbortSignal,
  ) => Promise<{ authorizations: ServerAuthorization[]; pageCount: number }>
  create: (payload: AuthorizationPayload) => Promise<ServerMessage>
  update: (id: string, payload: AuthorizationUpdatePayload) => Promise<ServerMessage>
  remove: (id: string) => Promise<ServerMessage>
}

// The id is the server's, as text; it goes back as it came.
const path = (id: string) => `/authorizations/${encodeURIComponent(id)}`

const live: AuthorizationsApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/authorizations',
      searchParams: { page },
      schema: authorizationPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/authorizations', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
}

function backend(): Promise<AuthorizationsApi> {
  return Promise.resolve(live)
}

async function send(call: (api: AuthorizationsApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, authorizationFormFieldFor)
  }
}

/**
 * Every authorization — the chart shows a case's, and a new visit offers its
 * case's. The list is paged by the server, so this reads page 1, then the
 * rest at once.
 */
export async function listAuthorizations(signal?: AbortSignal): Promise<ServerAuthorization[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.authorizations)
}

export function createAuthorization(payload: AuthorizationPayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updateAuthorization(id: string, payload: AuthorizationUpdatePayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

export function deleteAuthorization(id: string): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

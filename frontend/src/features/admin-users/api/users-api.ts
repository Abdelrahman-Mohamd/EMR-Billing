import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  toCreateUserPayload,
  toUpdateUserPayload,
  userDetailResponseSchema,
  userPageResponseSchema,
  type CreateUserPayload,
  type NewUserFormValues,
  type UpdateUserPayload,
  type User,
  type UserFormValues,
  type UserPage,
} from '../schemas/user'

/**
 * Admin → Users' only door to a server. **Live** (contracts confirmed
 * 2026-10-07), carrying the session's token: `GET /users?page=N`,
 * `GET /users/{id}`, `POST /users`, `PUT /users/{id}` and `DELETE /users/{id}`.
 * The list sends `page` (the server's 15) and the screen's search as `search`
 * (the name or email, in part — staging, 2026-10-20; user: use the server's
 * search). The server also takes `is_active`, which the screen does not
 * filter by. Writes resolve with the server's message,
 * which the screens show. Shapes in schemas/user.ts.
 *
 * A password is passed straight through: never logged, stored or cached.
 */
export interface UsersApi {
  list: (page: number, search: string, signal?: AbortSignal) => Promise<UserPage>
  get: (id: number, signal?: AbortSignal) => Promise<User>
  create: (payload: CreateUserPayload) => Promise<ServerMessage>
  update: (id: number, payload: UpdateUserPayload | { is_active: boolean }) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: UsersApi = {
  list: (page, search, signal) =>
    request({
      method: 'GET',
      path: '/users',
      searchParams: { page, search: search === '' ? undefined : search },
      schema: userPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/users/${id}`,
      schema: userDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/users', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/users/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: `/users/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<UsersApi> {
  return Promise.resolve(live)
}

/** The server names `is_active`; the form, `isActive`. */
const FORM_FIELD_FOR: Readonly<Record<string, string>> = { is_active: 'isActive' }

async function send(call: (api: UsersApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, FORM_FIELD_FOR)
  }
}

/** One page of the list — of the users matching `search`, when there is one. */
export async function listUsers(page: number, search = '', signal?: AbortSignal): Promise<UserPage> {
  return (await backend()).list(page, search, signal)
}

export async function getUser(id: number, signal?: AbortSignal): Promise<User> {
  return (await backend()).get(id, signal)
}

export function createUser(values: NewUserFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toCreateUserPayload(values)))
}

/** Saves a user; with a password only when a new one was typed. */
export function updateUser(id: number, values: UserFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toUpdateUserPayload(values)))
}

/** Activates or deactivates a user: their name and email as they are, the new status, no password. */
export function setUserActive(user: User, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(user.id, { name: user.name, email: user.email, is_active: isActive }))
}

export function deleteUser(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

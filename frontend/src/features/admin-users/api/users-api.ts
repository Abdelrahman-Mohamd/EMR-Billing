import { z } from 'zod'
import { ApiError } from '@/lib/api/api-error'
import {
  toCreateUserPayload,
  toUpdateUserPayload,
  userResponseSchema,
  type CreateUserPayload,
  type NewUserFormValues,
  type UpdateUserPayload,
  type User,
  type UserFormValues,
} from '../schemas/user'

/**
 * Admin → Users' only door to a server.
 *
 * **No endpoints exist yet.** The create body is known (the user payload);
 * paths, responses and the update body are not, so none are written. In
 * development and tests the calls go to an in-memory mock that plays the
 * server (ADR 0006); in any other build they reject as `unavailable`.
 *
 * Built: list, create, update — which also carries Deactivate / Reactivate,
 * since there is no separate status endpoint known. Not built: delete (the
 * prototype has none), and any admin password reset (not defined).
 *
 * The password in a create request is passed straight through: never logged,
 * stored or cached.
 */
export interface UsersApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: CreateUserPayload) => Promise<unknown>
  update: (id: number, payload: UpdateUserPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Users are not available right now.',
      detail: 'No user endpoints exist yet. features/admin-users/api/users-api.ts is the integration point.',
    }),
  )

const live: UsersApi = { list: notConnected, create: notConnected, update: notConnected }

async function backend(): Promise<UsersApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./users-api.mock')).mockUsersApi
  return live
}

export async function listUsers(signal?: AbortSignal): Promise<User[]> {
  return z.array(userResponseSchema).parse(await (await backend()).list(signal))
}

export async function createUser(values: NewUserFormValues): Promise<User> {
  return userResponseSchema.parse(await (await backend()).create(toCreateUserPayload(values)))
}

export async function updateUser(id: number, values: UserFormValues): Promise<User> {
  return userResponseSchema.parse(await (await backend()).update(id, toUpdateUserPayload(values)))
}

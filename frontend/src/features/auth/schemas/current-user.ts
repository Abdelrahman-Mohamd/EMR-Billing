import { z } from 'zod'

/**
 * The signed-in user, as the login response and `GET /auth/me` return it
 * (confirmed 2026-10-07): `{ id, name, email, is_active, created_at,
 * updated_at }` — nothing more. No role, permission or picture is in the contract, so none is
 * read. Extra fields in a response are dropped.
 */
export const userResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((wire) => ({
    id: wire.id,
    name: wire.name,
    email: wire.email,
    isActive: wire.is_active,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  }))

export type CurrentUser = z.output<typeof userResponseSchema>

/**
 * `POST /auth/login` → `{ success, message, data: { user, access_token,
 * token_type } }` (confirmed 2026-10-07). Only `data` is read; the message is
 * the server's wording and is not shown.
 */
export const loginResponseSchema = z
  .object({
    data: z.object({
      user: userResponseSchema,
      access_token: z.string().min(1),
      token_type: z.string().min(1),
    }),
  })
  .transform((wire) => ({
    user: wire.data.user,
    accessToken: wire.data.access_token,
    tokenType: wire.data.token_type,
  }))

export type LoginResult = z.output<typeof loginResponseSchema>

/**
 * `GET /auth/me` → `{ success, message, data: user }` (confirmed 2026-10-07).
 * Only `data` is read.
 */
export const meResponseSchema = z.object({ data: userResponseSchema }).transform((wire) => wire.data)

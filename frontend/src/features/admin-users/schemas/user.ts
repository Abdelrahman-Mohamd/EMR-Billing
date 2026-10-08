import { z } from 'zod'
import { emailSchema } from '@/lib/validation/email'

/**
 * A user, as the backend sends and takes it (contracts confirmed 2026-10-07):
 *
 * - `GET /users?page=N` → Laravel pagination (15 a page) of
 *   `{ id, name, email, is_active, created_at, updated_at }`;
 * - `GET /users/{id}` → `{ data: user }` (same fields);
 * - `POST /users` `{ name, email, password, is_active }`, `PUT /users/{id}` the
 *   same fields — a save may carry a new `password`, and leaves it out to keep
 *   the current one — and `DELETE /users/{id}`; each answers
 *   `{ success, message, data: null }`.
 *
 * No role, practice grant, username or service-account flag: the prototype
 * shows them, the backend does not have them.
 *
 * A response is parsed with **no password in the schema**: if a server ever
 * sent one back, parsing drops it here and it can never reach a screen.
 */
export const userResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    is_active: z.boolean(),
  })
  .transform((wire) => ({ id: wire.id, name: wire.name, email: wire.email, isActive: wire.is_active }))

export type User = z.output<typeof userResponseSchema>

export const userPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(userResponseSchema),
      meta: z.object({
        current_page: z.number().int().positive(),
        last_page: z.number().int().positive(),
        from: z.number().int().nullable().optional(),
        to: z.number().int().nullable().optional(),
        total: z.number().int().nonnegative(),
      }),
    }),
  })
  .transform(({ data }) => ({
    users: data.data,
    page: data.meta.current_page,
    pageCount: data.meta.last_page,
    total: data.meta.total,
    from: data.meta.from ?? 0,
    to: data.meta.to ?? 0,
  }))

export type UserPage = z.output<typeof userPageResponseSchema>

export const userDetailResponseSchema = z.object({ data: userResponseSchema }).transform((wire) => wire.data)

/** Creating a user — the confirmed payload, exactly. */
export interface CreateUserPayload {
  name: string
  email: string
  password: string
  is_active: boolean
}

/** Saving a user: the same fields; `password` only when a new one was typed. */
export interface UpdateUserPayload {
  name: string
  email: string
  password?: string
  is_active: boolean
}

/** Checked: presence and an email's shape. Password rules are the server's. */
export const userFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the user’s name.'),
  email: emailSchema('Enter an email address.'),
  /** A new password; empty keeps the current one. Not trimmed: a space may be part of it. */
  password: z.string(),
  isActive: z.boolean(),
})

export const newUserFormSchema = userFormSchema.extend({
  password: z.string().min(1, 'Enter a password.'),
})

export type UserFormValues = z.infer<typeof userFormSchema>
export type NewUserFormValues = z.infer<typeof newUserFormSchema>

export function toCreateUserPayload(values: NewUserFormValues): CreateUserPayload {
  return { name: values.name, email: values.email, password: values.password, is_active: values.isActive }
}

export function toUpdateUserPayload(values: UserFormValues): UpdateUserPayload {
  return {
    name: values.name,
    email: values.email,
    // Left out when empty: the server keeps the current password.
    ...(values.password === '' ? {} : { password: values.password }),
    is_active: values.isActive,
  }
}

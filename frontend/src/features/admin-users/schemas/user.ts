import { z } from 'zod'
import { emailSchema } from '@/lib/validation/email'

/**
 * A user, as the current backend payload defines it:
 * `{ name, email, password, is_active }` — nothing more. No role, practice
 * grant, username or service-account flag: the prototype shows them, the
 * payload does not have them.
 *
 * A response is parsed with **no password in the schema**: if a server ever
 * sent one back, parsing drops it here and it can never reach a screen.
 * Assumed until the contract says otherwise: a saved user comes back as its
 * payload, without the password, plus a numeric `id`.
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

/** Creating a user — the known payload, exactly. */
export interface CreateUserPayload {
  name: string
  email: string
  password: string
  is_active: boolean
}

/**
 * Saving an existing user. **Assumed**: the known payload without `password`
 * — the edit form never has one to send (see UserDialog). To be confirmed
 * with the backend.
 */
export interface UpdateUserPayload {
  name: string
  email: string
  is_active: boolean
}

/** Checked: presence and an email's shape. Password rules are the server's. */
export const userFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the user’s name.'),
  email: emailSchema('Enter an email address.'),
  isActive: z.boolean(),
})

export const newUserFormSchema = userFormSchema.extend({
  // Not trimmed: a space may be part of a password.
  password: z.string().min(1, 'Enter a password.'),
})

export type UserFormValues = z.infer<typeof userFormSchema>
export type NewUserFormValues = z.infer<typeof newUserFormSchema>

export function toCreateUserPayload(values: NewUserFormValues): CreateUserPayload {
  return { name: values.name, email: values.email, password: values.password, is_active: values.isActive }
}

export function toUpdateUserPayload(values: UserFormValues): UpdateUserPayload {
  return { name: values.name, email: values.email, is_active: values.isActive }
}

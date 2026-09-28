import { z } from 'zod'

/**
 * Who is signed in — the one source the account menu reads.
 *
 * **Assumed**: the backend will answer a "who am I" request with at least the
 * user's `name` and `email` (the two things the user payload shows a person
 * has). No endpoint and no response shape are known yet, so nothing else is
 * read — no picture, role or practice. Extra fields in a response are dropped.
 */
export const currentUserSchema = z.object({
  name: z.string(),
  email: z.string(),
})

export type CurrentUser = z.infer<typeof currentUserSchema>

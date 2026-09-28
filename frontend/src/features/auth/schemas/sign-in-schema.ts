import { z } from 'zod'
import { emailSchema } from '@/lib/validation/email'

/**
 * What the sign-in form accepts. The backend's login payload is
 * `{ email, password }`, so the identifier is the email address.
 *
 * Only presence and an email's shape are checked. Length or complexity rules
 * belong where a password is *set*; enforcing them here would reject a valid
 * account whose password predates a rule, and would tell an attacker what the
 * policy is.
 */
export const emailField = emailSchema('Enter your email.')

export const signInSchema = z.object({
  email: emailField,
  // Not trimmed: a leading or trailing space may be part of the password.
  password: z.string().min(1, 'Enter your password.'),
})

export type SignInValues = z.infer<typeof signInSchema>

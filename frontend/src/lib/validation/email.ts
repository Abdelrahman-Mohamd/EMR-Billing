import { z } from 'zod'

/**
 * An email field: trimmed, required, email-shaped. Shared so every form checks
 * an email the same way; only the "missing" wording is the caller's, because
 * "Enter your email" and "Enter an email address" are different sentences.
 */
export function emailSchema(requiredMessage: string) {
  return z.string().trim().min(1, requiredMessage).pipe(z.email('Enter a valid email address.'))
}

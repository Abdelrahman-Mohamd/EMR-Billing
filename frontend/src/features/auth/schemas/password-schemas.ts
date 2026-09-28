import { z } from 'zod'
import { emailField } from './sign-in-schema'

/**
 * The change-password and forgot-password forms.
 *
 * Checked here, because it is certain: every field is required, and a new
 * password must match its confirmation. **Not** checked, because nothing
 * defines it: length, complexity, reuse of the current password, or the code's
 * format and length. The server enforces its own rules and its message lands on
 * the field it names.
 */
const MISMATCH = 'The passwords do not match.'

// Passwords are never trimmed: a space may be part of one.
const newPassword = z.string().min(1, 'Enter a new password.')
const confirmPassword = z.string().min(1, 'Confirm the new password.')

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword,
    confirmPassword,
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: MISMATCH,
  })

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

/** Forgot password, step 1: where to send the code. */
export const sendCodeSchema = z.object({ email: emailField })
export type SendCodeValues = z.infer<typeof sendCodeSchema>

/** Step 2: the code from the email. Presence only — its format is the server's. */
export const verifyCodeSchema = z.object({ otp: z.string().trim().min(1, 'Enter the code from the email.') })
export type VerifyCodeValues = z.infer<typeof verifyCodeSchema>

/** Step 3: the new password. The email and code come from the earlier steps. */
export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: MISMATCH,
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

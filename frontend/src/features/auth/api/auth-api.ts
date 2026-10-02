import { ApiError, renameFieldErrors } from '@/lib/api/api-error'
import type {
  ChangePasswordRequest,
  ResetPasswordRequest,
  SendOtpRequest,
  SignInRequest,
  VerifyOtpRequest,
} from '../schemas/auth-payloads'
import type { ChangePasswordValues, ResetPasswordValues, SendCodeValues } from '../schemas/password-schemas'
import { currentUserSchema, type CurrentUser } from '../schemas/current-user'
import type { SignInValues } from '../schemas/sign-in-schema'
import {
  FORM_FIELD_FOR,
  toChangePasswordRequest,
  toResetPasswordRequest,
  toSendOtpRequest,
  toSignInRequest,
  toVerifyOtpRequest,
} from './payloads'

/**
 * Authentication's only door to a server: sign in, sign out, who is signed in,
 * change password, and the three forgot-password steps (send code, verify
 * code, reset password).
 *
 * **Known:** the request bodies, exactly (`schemas/auth-payloads.ts`). Sign
 * out and "who am I" have no known payload or endpoint at all.
 * **Not known yet, so not written:** the endpoint paths, the response bodies,
 * how the session is carried (cookie or token), and whether verifying a code
 * or resetting a password returns anything. Every call therefore resolves with
 * nothing and nothing from a response is used. In development and tests the
 * calls go to a mock that plays the server (`auth-api.mock.ts`); in any other
 * build they reject as `unavailable`. When the endpoints are known, `live`
 * becomes five `request()` calls and nothing outside this file changes.
 *
 * Passwords and codes pass straight through: never logged, stored, cached or
 * put in a URL. The screens call these functions directly rather than through
 * `useMutation`, which would keep them in the query cache (see SignInForm).
 */
export interface AuthApi {
  signIn: (payload: SignInRequest) => Promise<unknown>
  changePassword: (payload: ChangePasswordRequest) => Promise<unknown>
  sendOtp: (payload: SendOtpRequest) => Promise<unknown>
  verifyOtp: (payload: VerifyOtpRequest) => Promise<unknown>
  resetPassword: (payload: ResetPasswordRequest) => Promise<unknown>
  currentUser: (signal?: AbortSignal) => Promise<unknown>
  signOut: () => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'This service is not available right now.',
      detail:
        'Authentication endpoints are not known yet (only their payloads). features/auth/api/auth-api.ts is the integration point.',
    }),
  )

const live: AuthApi = {
  signIn: notConnected,
  changePassword: notConnected,
  sendOtp: notConnected,
  verifyOtp: notConnected,
  resetPassword: notConnected,
  currentUser: notConnected,
  signOut: notConnected,
}

async function backend(): Promise<AuthApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./auth-api.mock')).mockAuthApi
  return live
}

async function send(call: (api: AuthApi) => Promise<unknown>): Promise<void> {
  try {
    await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, FORM_FIELD_FOR)
  }
}

export function signIn(values: SignInValues): Promise<void> {
  return send((api) => api.signIn(toSignInRequest(values)))
}

export function changePassword(values: ChangePasswordValues): Promise<void> {
  return send((api) => api.changePassword(toChangePasswordRequest(values)))
}

export function sendOtp(values: SendCodeValues): Promise<void> {
  return send((api) => api.sendOtp(toSendOtpRequest(values)))
}

export function verifyOtp(email: string, otp: string): Promise<void> {
  return send((api) => api.verifyOtp(toVerifyOtpRequest(email, otp)))
}

export function resetPassword(email: string, otp: string, values: ResetPasswordValues): Promise<void> {
  return send((api) => api.resetPassword(toResetPasswordRequest(email, otp, values)))
}

/** Who is signed in. The only response in this file that is read (see its schema). */
export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  return currentUserSchema.parse(await (await backend()).currentUser(signal))
}

/** Ends the session on the server. What it clears there is the server's business. */
export function signOut(): Promise<void> {
  return send((api) => api.signOut())
}

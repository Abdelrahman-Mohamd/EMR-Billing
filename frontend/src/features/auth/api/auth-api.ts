import { ApiError, isApiError, renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import { clearSession, expectSessionEnd, hasSession, setSession } from '@/lib/auth/session'
import type {
  ChangePasswordRequest,
  ResetPasswordRequest,
  SendOtpRequest,
  SignInRequest,
  VerifyOtpRequest,
} from '../schemas/auth-payloads'
import type { ChangePasswordValues, ResetPasswordValues, SendCodeValues } from '../schemas/password-schemas'
import {
  loginResponseSchema,
  meResponseSchema,
  type CurrentUser,
  type LoginResult,
} from '../schemas/current-user'
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
 * **Sign in is live** (contract confirmed 2026-10-07): `POST /auth/login` with
 * `{ email, password }` → `{ data: { user, access_token, token_type } }`. The
 * token is kept in memory (`lib/auth/session.ts`) and sent by the http client
 * as `Authorization: Bearer …`, so after a page reload the user signs in
 * again. **Who is signed in is live** (2026-10-07): `GET /auth/me`, carrying
 * the token, → `{ data: user }`; without a valid token, `401`. **Sign out is
 * live** (2026-10-07): `POST /auth/logout`, carrying the token, revokes it on
 * the server (observed on staging: 200, then that token gets 401); the token
 * is then forgotten here whatever the answer. **Forgot password is live** (2026-10-07):
 * `POST /auth/forgot-password/send-otp` `{ email }`, `…/verify-otp`
 * `{ email, otp }` and `…/reset` `{ email, otp, password,
 * password_confirmation }`; only their status is relied on. A wrong or expired
 * code is answered `400 { message: "Invalid OTP." }`, with no field, which the
 * screens put on the code; field errors come as a 422. **Change password is
 * live** (2026-10-07): `POST /auth/change-password` `{ current_password,
 * new_password, new_password_confirmation }`, carrying the token; a wrong
 * current password is answered `400` with no field, which the dialog puts on
 * that field.
 *
 * The calls go to the backend in `.env`; with none configured (the tests),
 * they reject as `unavailable` without being sent.
 *
 * Passwords and codes pass straight through: never logged, stored, cached or
 * put in a URL. The screens call these functions directly rather than through
 * `useMutation`, which would keep them in the query cache (see SignInForm).
 */
export interface AuthApi {
  signIn: (payload: SignInRequest) => Promise<LoginResult>
  me: () => Promise<CurrentUser>
  changePassword: (payload: ChangePasswordRequest) => Promise<ServerMessage>
  sendOtp: (payload: SendOtpRequest) => Promise<ServerMessage>
  verifyOtp: (payload: VerifyOtpRequest) => Promise<ServerMessage>
  resetPassword: (payload: ResetPasswordRequest) => Promise<ServerMessage>
  signOut: () => Promise<ServerMessage>
}

const live: AuthApi = {
  signIn: (payload) =>
    request({ method: 'POST', path: '/auth/login', body: payload, schema: loginResponseSchema }),
  me: () => request({ method: 'GET', path: '/auth/me', schema: meResponseSchema }),
  // Change password (confirmed 2026-10-07), with the signed-in session's token.
  // A wrong current password is answered `400 { message }` with no field.
  changePassword: (payload) =>
    request({ method: 'POST', path: '/auth/change-password', body: payload, schema: serverMessageSchema }),
  // Forgot password (confirmed 2026-10-07). Only the status is relied on: send-otp
  // answers `{ success, message, data: null }` whether or not the email has an
  // account, and nothing in the other two answers is needed.
  sendOtp: (payload) =>
    request({
      method: 'POST',
      path: '/auth/forgot-password/send-otp',
      body: payload,
      schema: serverMessageSchema,
    }),
  verifyOtp: (payload) =>
    request({
      method: 'POST',
      path: '/auth/forgot-password/verify-otp',
      body: payload,
      schema: serverMessageSchema,
    }),
  resetPassword: (payload) =>
    request({
      method: 'POST',
      path: '/auth/forgot-password/reset',
      body: payload,
      schema: serverMessageSchema,
    }),
  // Only the status is relied on; the body (`{ success, message, data: null }`) is not read.
  signOut: () => request({ method: 'POST', path: '/auth/logout', schema: serverMessageSchema }),
}

function backend(): Promise<AuthApi> {
  return Promise.resolve(live)
}

/** Sends a call; resolves with the server's message, which the screens show. */
async function send(call: (api: AuthApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, FORM_FIELD_FOR)
  }
}

/**
 * Signs in: sends exactly `{ email, password }`, keeps the returned token for
 * every later request, and resolves with the user — never with the token.
 */
export async function signIn(values: SignInValues): Promise<CurrentUser> {
  let result: LoginResult
  try {
    result = await (await backend()).signIn(toSignInRequest(values))
  } catch (error) {
    throw renameFieldErrors(error, FORM_FIELD_FOR)
  }
  setSession({ accessToken: result.accessToken, tokenType: result.tokenType })
  return result.user
}

export function changePassword(values: ChangePasswordValues): Promise<ServerMessage> {
  return send((api) => api.changePassword(toChangePasswordRequest(values)))
}

export function sendOtp(values: SendCodeValues): Promise<ServerMessage> {
  return send((api) => api.sendOtp(toSendOtpRequest(values)))
}

export function verifyOtp(email: string, otp: string): Promise<ServerMessage> {
  return send((api) => api.verifyOtp(toVerifyOtpRequest(email, otp)))
}

export function resetPassword(
  email: string,
  otp: string,
  values: ResetPasswordValues,
): Promise<ServerMessage> {
  return send((api) => api.resetPassword(toResetPasswordRequest(email, otp, values)))
}

/**
 * Who is signed in, asked of the server with the session's token. Without a
 * session nothing is sent: `unauthenticated`. A token the server no longer
 * accepts (`401`) ends the session in the http client.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  if (!hasSession()) throw new ApiError({ kind: 'unauthenticated', message: 'Sign in to continue.' })
  return (await backend()).me()
}

/**
 * Signs out: asks the server to revoke the token, then — whatever it answered —
 * forgets the token in this browser. Rejects only when the server
 * could not confirm it (so the account menu can say only this browser was
 * signed out); a `401` means the token was already not accepted, which is
 * signed out too.
 */
export async function signOut(): Promise<ServerMessage> {
  // This tab's own doing: the refusal of a request still in flight, or of the
  // logout itself, must not read as the session having ended on its own.
  expectSessionEnd('signed-out')
  try {
    return await send((api) => api.signOut())
  } catch (error) {
    if (!(isApiError(error) && error.kind === 'unauthenticated')) throw error
    return null
  } finally {
    clearSession()
  }
}

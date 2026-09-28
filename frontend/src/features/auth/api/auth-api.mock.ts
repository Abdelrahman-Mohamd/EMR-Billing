import { ApiError } from '@/lib/api/api-error'
import type { AuthApi } from './auth-api'

/**
 * A stand-in authentication server for development and demos (ADR 0006).
 * Never part of a production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It receives the real payloads and accepts them. It is **not**
 * authentication: no account list, no session, no email is sent; "who am I"
 * always answers with the same fictional person. So a demo can
 * show the failure paths, three inputs are refused, and only these:
 *
 * - password `incorrect` at sign-in → 401, wrong credentials
 * - current password `incorrect` when changing it → 422 on `current_password`
 * - code `000000` → 422 on `otp`
 *
 * How the real server words or shapes these errors is unknown; the screens
 * handle them through `ApiError` only.
 */
const LATENCY_MS = 400
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

function invalid(path: string, message: string): ApiError {
  return new ApiError({
    kind: 'validation',
    message: 'Some fields need attention.',
    status: 422,
    fieldErrors: [{ path, message }],
  })
}

export const mockAuthApi: AuthApi = {
  async signIn(payload) {
    await wait()
    if (payload.password === 'incorrect') {
      throw new ApiError({ kind: 'unauthenticated', message: 'Unauthenticated.', status: 401 })
    }
  },
  async changePassword(payload) {
    await wait()
    if (payload.current_password === 'incorrect') {
      throw invalid('current_password', 'The current password is incorrect.')
    }
  },
  async sendOtp() {
    await wait()
  },
  async verifyOtp(payload) {
    await wait()
    if (payload.otp === '000000') throw invalid('otp', 'This code is invalid or has expired.')
  },
  async resetPassword(payload) {
    await wait()
    if (payload.otp === '000000') throw invalid('otp', 'This code is invalid or has expired.')
  },
  // A fictional signed-in person, so the account menu has someone to show.
  async currentUser() {
    await wait()
    return { name: 'Dana Whitfield', email: 'd.whitfield@harborline.example' }
  },
  async signOut() {
    await wait()
  },
}

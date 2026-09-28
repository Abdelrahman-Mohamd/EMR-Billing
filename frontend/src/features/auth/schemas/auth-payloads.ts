/**
 * The request bodies, exactly as the backend's payloads define them. Built
 * only in `api/payloads.ts`, whose tests pin them field for field.
 *
 * Responses are not typed here because none is known yet (see
 * `api/auth-api.ts`).
 */
export interface SignInRequest {
  email: string
  password: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  new_password_confirmation: string
}

export interface SendOtpRequest {
  email: string
}

export interface VerifyOtpRequest {
  email: string
  otp: string
}

export interface ResetPasswordRequest {
  email: string
  otp: string
  password: string
  password_confirmation: string
}

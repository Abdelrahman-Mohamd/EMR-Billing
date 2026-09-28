import type {
  ChangePasswordRequest,
  ResetPasswordRequest,
  SendOtpRequest,
  SignInRequest,
  VerifyOtpRequest,
} from '../schemas/auth-payloads'
import type { ChangePasswordValues, ResetPasswordValues, SendCodeValues } from '../schemas/password-schemas'
import type { SignInValues } from '../schemas/sign-in-schema'

/**
 * Form values → request bodies: the only code that knows both the form's names
 * (`confirmPassword`) and the backend's (`password_confirmation`). Values are
 * copied, never logged.
 */
export function toSignInRequest(values: SignInValues): SignInRequest {
  return { email: values.email, password: values.password }
}

export function toChangePasswordRequest(values: ChangePasswordValues): ChangePasswordRequest {
  return {
    current_password: values.currentPassword,
    new_password: values.newPassword,
    new_password_confirmation: values.confirmPassword,
  }
}

export function toSendOtpRequest(values: SendCodeValues): SendOtpRequest {
  return { email: values.email }
}

export function toVerifyOtpRequest(email: string, otp: string): VerifyOtpRequest {
  return { email, otp }
}

export function toResetPasswordRequest(
  email: string,
  otp: string,
  values: ResetPasswordValues,
): ResetPasswordRequest {
  return { email, otp, password: values.password, password_confirmation: values.confirmPassword }
}

/**
 * Backend field names → form field names, so a server error lands on the
 * field the user typed in. Names the forms share with the backend (`email`,
 * `password`, `otp`) need no entry.
 */
export const FORM_FIELD_FOR: Readonly<Record<string, string>> = {
  current_password: 'currentPassword',
  new_password: 'newPassword',
  new_password_confirmation: 'confirmPassword',
  password_confirmation: 'confirmPassword',
}

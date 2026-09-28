import { describe, expect, it } from 'vitest'
import {
  toChangePasswordRequest,
  toResetPasswordRequest,
  toSendOtpRequest,
  toSignInRequest,
  toVerifyOtpRequest,
} from './payloads'

// Each body must be exactly the backend's payload: these names, nothing more.
// (Invented values — never the example credentials.)

describe('authentication payloads', () => {
  it('sign in: { email, password }', () => {
    expect(toSignInRequest({ email: 'user@example.test', password: 'pw-1' })).toStrictEqual({
      email: 'user@example.test',
      password: 'pw-1',
    })
  })

  it('change password: { current_password, new_password, new_password_confirmation }', () => {
    expect(
      toChangePasswordRequest({
        currentPassword: 'old-pw',
        newPassword: 'new-pw',
        confirmPassword: 'new-pw',
      }),
    ).toStrictEqual({
      current_password: 'old-pw',
      new_password: 'new-pw',
      new_password_confirmation: 'new-pw',
    })
  })

  it('send code: { email }', () => {
    expect(toSendOtpRequest({ email: 'user@example.test' })).toStrictEqual({ email: 'user@example.test' })
  })

  it('verify code: { email, otp }', () => {
    expect(toVerifyOtpRequest('user@example.test', '123456')).toStrictEqual({
      email: 'user@example.test',
      otp: '123456',
    })
  })

  it('reset password: { email, otp, password, password_confirmation }', () => {
    expect(
      toResetPasswordRequest('user@example.test', '123456', {
        password: 'new-pw',
        confirmPassword: 'new-pw',
      }),
    ).toStrictEqual({
      email: 'user@example.test',
      otp: '123456',
      password: 'new-pw',
      password_confirmation: 'new-pw',
    })
  })
})

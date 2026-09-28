import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { changePassword, resetPassword, sendOtp, signIn, verifyOtp } from './auth-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authentication API without a backend', () => {
  it('answers every call as unavailable instead of inventing an endpoint', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    for (const call of [
      () => signIn({ email: 'user@example.test', password: 'pw' }),
      () => changePassword({ currentPassword: 'a', newPassword: 'b', confirmPassword: 'b' }),
      () => sendOtp({ email: 'user@example.test' }),
      () => verifyOtp('user@example.test', '123456'),
      () => resetPassword('user@example.test', '123456', { password: 'b', confirmPassword: 'b' }),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

describe('authentication API against the development mock', () => {
  it('renames a backend field in an error to the form’s field, so it lands on the right input', async () => {
    // The mock refuses the current password "incorrect" on `current_password`.
    const error: unknown = await changePassword({
      currentPassword: 'incorrect',
      newPassword: 'b',
      confirmPassword: 'b',
    }).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'currentPassword',
    ])
  })

  it('resolves with nothing when the server accepts: no response field is relied on', async () => {
    await expect(sendOtp({ email: 'user@example.test' })).resolves.toBeUndefined()
    await expect(verifyOtp('user@example.test', '123456')).resolves.toBeUndefined()
  })
})

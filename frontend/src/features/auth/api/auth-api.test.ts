import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { changePassword, resetPassword, sendOtp, signIn, verifyOtp } from './auth-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authentication API without a backend', () => {
  it('answers every call as unavailable instead of inventing an endpoint', async () => {
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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { createUser, listUsers, updateUser } from './users-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('users API without a backend', () => {
  it('answers every call as unavailable instead of inventing an endpoint', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    for (const call of [
      () => listUsers(),
      () => createUser({ name: 'Ada Lin', email: 'ada@example.test', password: 'pw', isActive: true }),
      () => updateUser(1, { name: 'Ada Lin', email: 'ada@example.test', isActive: true }),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

describe('users API against the development mock', () => {
  it('creates a user and never hands the password back, then or later', async () => {
    const created = await createUser({
      name: 'Ada Lin',
      email: 'ada@example.test',
      password: 'mock-secret-1',
      isActive: true,
    })
    expect(created).toMatchObject({ name: 'Ada Lin', email: 'ada@example.test', isActive: true })
    const all = await listUsers()
    expect(JSON.stringify([created, all])).not.toContain('mock-secret-1')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { createOrganization, listOrganizations, updateOrganization } from './organizations-api'

// A production build: no mock data, and no API contract yet.
beforeEach(() => {
  vi.stubGlobal('__MOCK_DATA__', false)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('organizations API without a backend', () => {
  it('answers every call as unavailable instead of inventing a request', async () => {
    for (const call of [
      () => listOrganizations(),
      () => createOrganization({ name: 'Cedar Valley Health', isActive: true }),
      () => updateOrganization(1, { name: 'Cedar Valley Health', isActive: true }),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

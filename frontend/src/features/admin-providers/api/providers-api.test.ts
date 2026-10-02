import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { NEW_PROVIDER_VALUES } from '../schemas/provider'
import { mockProvidersApi } from './providers-api.mock'
import { createProvider, listProviders, updateProvider } from './providers-api'

const values = {
  ...NEW_PROVIDER_VALUES,
  practiceId: '1',
  firstName: 'Priya',
  lastName: 'Raman',
  code: '340',
  providerType: 'Billing',
  npi: '1386950417',
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('providers API without a backend', () => {
  it('answers every call as unavailable instead of inventing an endpoint', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    for (const call of [
      () => listProviders(),
      () => createProvider(values),
      () => updateProvider(1, values),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

describe('providers API against the development mock', () => {
  it('sends the provisional body and reads the provider back in the screen’s shape', async () => {
    const create = vi.spyOn(mockProvidersApi, 'create')
    const created = await createProvider(values)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ practice_id: 1, provider_type: 'Billing' }))
    expect(created).toMatchObject({ practiceId: 1, firstName: 'Priya', providerType: 'Billing' })
    expect((await listProviders()).some((provider) => provider.id === created.id)).toBe(true)
  })
})

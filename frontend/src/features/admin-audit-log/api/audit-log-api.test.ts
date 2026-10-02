import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { listAuditEntries } from './audit-log-api'

const query = { search: '', modules: [], page: 1, pageSize: 20 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('audit log API without a backend', () => {
  it('answers as unavailable instead of inventing an endpoint', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    const error: unknown = await listAuditEntries(query).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('unavailable')
  })
})

describe('audit log API against the development mock', () => {
  it('returns one page and the total, newest first', async () => {
    const page = await listAuditEntries(query)
    expect(page.entries).toHaveLength(20)
    expect(page.total).toBe(57)
    const times = page.entries.map((entry) => Date.parse(entry.at))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    expect((await listAuditEntries({ ...query, page: 3 })).entries).toHaveLength(17)
  })

  it('searches action, detail and user, and filters by module', async () => {
    const byUser = await listAuditEntries({ ...query, search: 'keisha' })
    expect(byUser.entries.every((entry) => entry.userName === 'Keisha Morgan')).toBe(true)
    const byDetail = await listAuditEntries({ ...query, search: 'nf-3' })
    expect(byDetail.total).toBe(0)
    const byModule = await listAuditEntries({ ...query, modules: ['PAYMENTS', 'MONTHEND'] })
    expect(new Set(byModule.entries.map((entry) => entry.module))).toEqual(new Set(['PAYMENTS', 'MONTHEND']))
  })
})

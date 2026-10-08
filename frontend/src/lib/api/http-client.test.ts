import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError, userMessage } from './api-error'
import { request } from './http-client'
import { serverMessageSchema } from './server-message'

// The app configured for a backend; only the network is faked.
vi.mock('@/lib/config/env', () => ({
  env: {
    apiBaseUrl: 'https://api.example.test/api/v1',
    dataSource: 'live',
    environment: 'staging',
    isLive: true,
  },
}))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

/** What the user is shown when a request with this answer fails. */
async function shownFor(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(json(status, body))
  const error: unknown = await request({ method: 'DELETE', path: '/locations/1' }).catch(
    (caught: unknown) => caught,
  )
  if (!isApiError(error)) throw new Error('expected an ApiError')
  return { error, shown: userMessage(error) }
}

describe('the server message, shown as it is', () => {
  it('keeps the server sentence when it comes with field errors', async () => {
    const { error, shown } = await shownFor(422, {
      message: 'A practice must have at least one location; this is its last one.',
      errors: { location: ['A practice must have at least one location; this is its last one.'] },
    })
    expect(shown).toBe('A practice must have at least one location; this is its last one.')
    expect(error.fieldErrors).toEqual([
      { path: 'location', message: 'A practice must have at least one location; this is its last one.' },
    ])
  })

  it('shows the server words for a refusal of any 4xx kind, not ours', async () => {
    expect((await shownFor(400, { success: false, message: 'Invalid OTP.', errors: [] })).shown).toBe(
      'Invalid OTP.',
    )
    expect((await shownFor(403, { message: 'You may not delete this practice.' })).shown).toBe(
      'You may not delete this practice.',
    )
    expect((await shownFor(409, { message: 'This location has visits.' })).shown).toBe(
      'This location has visits.',
    )
  })

  it('keeps its own words where the server text is technical or absent', async () => {
    // Laravel's not-found text names a model and an id.
    expect(
      (await shownFor(404, { message: 'No query results for model [App\\Models\\Location] 9' })).shown,
    ).toBe('This record could not be found.')
    expect(
      (await shownFor(404, { message: 'The route api/v1/locations/abc could not be found.' })).shown,
    ).toBe('This record could not be found.')
    // A 5xx can carry an exception — never shown.
    expect(
      (await shownFor(500, { message: 'SQLSTATE[23000]: Integrity constraint violation: 1451 …' })).shown,
    ).toBe('Something went wrong. Please try again.')
    // No message at all.
    expect((await shownFor(403, {})).shown).toBe('You do not have access to this.')
  })
})

describe('a write answer', () => {
  it('reads the server success message', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, message: 'Location deleted successfully', data: null }),
    )
    await expect(
      request({ method: 'DELETE', path: '/locations/1', schema: serverMessageSchema }),
    ).resolves.toBe('Location deleted successfully')
  })

  it('reads no message as null, and never fails on the shape of a successful answer', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(
      request({ method: 'DELETE', path: '/locations/1', schema: serverMessageSchema }),
    ).resolves.toBeNull()
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: null }))
    await expect(
      request({ method: 'DELETE', path: '/locations/1', schema: serverMessageSchema }),
    ).resolves.toBeNull()
  })
})

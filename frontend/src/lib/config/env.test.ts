import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('environment configuration', () => {
  it('treats an empty API base URL as "no backend yet"', () => {
    const env = parseEnv({ VITE_API_BASE_URL: '', VITE_DATA_SOURCE: 'mock', VITE_ENVIRONMENT: 'development' })
    expect(env.isLive).toBe(false)
  })

  it('is not live while the data source is mock, even with a base URL set', () => {
    const env = parseEnv({
      VITE_API_BASE_URL: 'https://api.example.com',
      VITE_DATA_SOURCE: 'mock',
      VITE_ENVIRONMENT: 'staging',
    })
    expect(env.isLive).toBe(false)
  })

  it('is live only with both a data source and a base URL', () => {
    const env = parseEnv({
      VITE_API_BASE_URL: 'https://api.example.com',
      VITE_DATA_SOURCE: 'live',
      VITE_ENVIRONMENT: 'production',
    })
    expect(env.isLive).toBe(true)
    expect(env.apiBaseUrl).toBe('https://api.example.com')
  })

  it('rejects an unknown environment name instead of guessing', () => {
    expect(() => parseEnv({ VITE_ENVIRONMENT: 'prod' })).toThrow(/VITE_ENVIRONMENT/)
  })

  it('does not repeat the offending value in the error, which may be a URL with a token', () => {
    let message = ''
    try {
      parseEnv({ VITE_API_BASE_URL: 'not-a-url?token=secret123' })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('VITE_API_BASE_URL')
    expect(message).not.toContain('secret123')
  })
})

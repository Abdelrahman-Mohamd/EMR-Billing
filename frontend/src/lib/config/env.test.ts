import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('environment configuration', () => {
  it('treats an empty API base URL as "no backend": nothing is sent', () => {
    const env = parseEnv({ VITE_API_BASE_URL: '', VITE_ENVIRONMENT: 'test' })
    expect(env.isLive).toBe(false)
  })

  it('talks to the backend whenever its base URL is set — there is no mock data source', () => {
    const env = parseEnv({
      VITE_API_BASE_URL: 'https://api.example.test/api/v1',
      VITE_ENVIRONMENT: 'staging',
    })
    expect(env.isLive).toBe(true)
    expect(env.apiBaseUrl).toBe('https://api.example.test/api/v1')
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

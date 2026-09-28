import { describe, expect, it } from 'vitest'
import { ApiError, userMessage } from './api-error'

describe('ApiError', () => {
  it('retries only failures that a retry can fix', () => {
    expect(new ApiError({ kind: 'network', message: 'x' }).isRetryable).toBe(true)
    expect(new ApiError({ kind: 'server', message: 'x' }).isRetryable).toBe(true)
    expect(new ApiError({ kind: 'forbidden', message: 'x' }).isRetryable).toBe(false)
    expect(new ApiError({ kind: 'validation', message: 'x' }).isRetryable).toBe(false)
  })

  it('never shows a user the server text for an unexpected failure', () => {
    const error = new ApiError({
      kind: 'server',
      message: 'psycopg2.errors.UniqueViolation: duplicate key claim_pkey',
      status: 500,
    })
    expect(userMessage(error)).toBe('Something went wrong. Please try again.')
  })

  it('does show the server text for a validation failure, which is written for the user', () => {
    const error = new ApiError({ kind: 'validation', message: 'Member ID is required.', status: 422 })
    expect(userMessage(error)).toBe('Member ID is required.')
  })

  it('has a message for a thrown value that is not an ApiError at all', () => {
    expect(userMessage(new TypeError('undefined is not a function'))).toBe(
      'Something went wrong. Please try again.',
    )
  })
})

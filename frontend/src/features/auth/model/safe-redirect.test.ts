import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('goes to the start page when nothing was asked for', () => {
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect('')).toBe('/')
  })

  it('returns to a page inside the application, keeping its query and hash', () => {
    expect(safeRedirect('/claims/abc?tab=history#top')).toBe('/claims/abc?tab=history#top')
  })

  it.each([
    ['another origin', 'https://evil.example/login'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash that browsers read as a slash', '/\\evil.example'],
    ['a relative path', 'claims/abc'],
    ['a script URL', 'javascript:alert(1)'],
    ['a tab that browsers strip into "//"', '/\t/evil.example'],
  ])('refuses %s', (_label, value) => {
    expect(safeRedirect(value)).toBe('/')
  })

  it('never sends someone back to the sign-in page itself', () => {
    expect(safeRedirect('/login')).toBe('/')
    expect(safeRedirect('/login?redirect=/claims')).toBe('/')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'billing.session'
const credential = { accessToken: 'test-token-123', tokenType: 'Bearer' }

/** A fresh copy of the module, as after a page reload. */
const reload = async () => {
  vi.resetModules()
  return import('./session')
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('session', () => {
  it('keeps the token in localStorage, so a reload stays signed in', async () => {
    const session = await reload()
    session.setSession(credential)
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual(credential)

    const afterReload = await reload()
    expect(afterReload.hasSession()).toBe(true)
    expect(afterReload.authorizationHeader()).toBe('Bearer test-token-123')
  })

  it('forgets it on sign-out, in memory and in storage', async () => {
    const session = await reload()
    session.setSession(credential)
    session.clearSession()
    expect(session.hasSession()).toBe(false)
    expect(session.authorizationHeader()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect((await reload()).hasSession()).toBe(false)
  })

  it('treats a malformed stored value as signed out', async () => {
    localStorage.setItem(KEY, '{not json')
    expect((await reload()).hasSession()).toBe(false)
    localStorage.setItem(KEY, JSON.stringify({ accessToken: '' }))
    expect((await reload()).hasSession()).toBe(false)
  })

  it('still works for the tab when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    const session = await reload()
    session.setSession(credential)
    expect(session.authorizationHeader()).toBe('Bearer test-token-123')
  })

  it('follows sign-in and sign-out in another tab', async () => {
    const session = await reload()
    localStorage.setItem(KEY, JSON.stringify(credential))
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    expect(session.hasSession()).toBe(true)

    localStorage.removeItem(KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    expect(session.hasSession()).toBe(false)
  })
})

describe('the session ending', () => {
  it('says why when it ends by itself, and nothing when this tab signed out', async () => {
    const session = await reload()
    const heard = vi.fn()
    session.onSessionEnd(heard)
    session.setSession(credential)
    session.clearSession()
    expect(heard).not.toHaveBeenCalled()
    session.setSession(credential)
    session.clearSession('rejected')
    expect(heard).toHaveBeenLastCalledWith('rejected')
    // Already signed out: nothing more to say.
    session.clearSession('rejected')
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('reads the first refusal after one’s own new password as that, and sign-out as silent', async () => {
    const session = await reload()
    const heard = vi.fn()
    session.onSessionEnd(heard)
    session.setSession(credential)
    session.expectSessionEnd('password-changed')
    session.clearSession('rejected')
    expect(heard).toHaveBeenLastCalledWith('password-changed')
    session.setSession(credential)
    session.expectSessionEnd('signed-out')
    session.clearSession('rejected')
    expect(heard).toHaveBeenCalledTimes(1)
    // A withdrawn expectation (the save failed) leaves the reason as it comes.
    session.setSession(credential)
    session.expectSessionEnd('password-changed')
    session.expectSessionEnd(null)
    session.clearSession('rejected')
    expect(heard).toHaveBeenLastCalledWith('rejected')
  })

  it('says so when another tab signs out', async () => {
    const session = await reload()
    const heard = vi.fn()
    session.onSessionEnd(heard)
    session.setSession(credential)
    localStorage.removeItem(KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    expect(session.hasSession()).toBe(false)
    expect(heard).toHaveBeenLastCalledWith('elsewhere')
  })
})

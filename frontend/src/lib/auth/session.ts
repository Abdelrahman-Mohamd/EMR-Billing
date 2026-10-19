import { z } from 'zod'

/**
 * The signed-in session's credential: the access token the login response
 * returns, and its type ("Bearer").
 *
 * **Kept in `localStorage`** (the user's decision, 2026-10-07 — docs/SECURITY.md
 * §2), so a page reload or a new tab stays signed in until sign-out or a
 * `401`. This file is the only place that touches it; nothing else is stored
 * with it, and the token is never logged. A copy is kept in memory, so the
 * session still works for the tab when storage is blocked (private mode,
 * site data off) — it then ends with the tab, as before. Signing in or out in
 * another tab is followed here through the `storage` event.
 *
 * Written by sign-in (`features/auth`), read by the http client to send
 * `Authorization: <type> <token>`, cleared by sign-out and by a `401` on a
 * request that carried it. The route guard checks a restored token with the
 * server once (`routes/_app.tsx`).
 *
 * When the session ends without this tab signing out — the server refused it,
 * another tab signed out, the user's own password was changed — the listeners
 * of `onSessionEnd` hear why, so the app can go to sign-in at once and say so
 * (user, 2026-10-19: a dead session left a screen whose "Try again" could not
 * work). This tab's own sign-out says nothing: it goes to sign-in itself.
 */
export interface SessionCredential {
  accessToken: string
  /** As the server names it: "Bearer". */
  tokenType: string
}

const STORAGE_KEY = 'billing.session'

const storedSchema = z.object({ accessToken: z.string().min(1), tokenType: z.string().min(1) })

/** What storage holds, or null — a missing, unreadable or malformed value counts as signed out. */
function readStored(): SessionCredential | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function writeStored(credential: SessionCredential | null): void {
  try {
    if (credential === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(credential))
  } catch {
    // Storage blocked or full: the in-memory copy carries the session for this tab.
  }
}

/**
 * Why a session ended, when this tab did not sign out: the server refused the
 * token (`rejected`), another tab signed out (`elsewhere`), or the user saved a
 * new password for themselves (`password-changed`), which signs them out
 * everywhere.
 */
export type SessionEnd = 'rejected' | 'elsewhere' | 'password-changed'

let current: SessionCredential | null = readStored()
const endListeners = new Set<(reason: SessionEnd) => void>()
/** The reason the next end will have, set by whoever is about to cause it. */
let expected: SessionEnd | 'signed-out' | null = null

function ended(reason: SessionEnd | 'signed-out'): void {
  if (reason === 'signed-out') return
  for (const listener of endListeners) listener(reason)
}

if (typeof window !== 'undefined') {
  // Another tab signed in or out (storage.clear() reports a null key).
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    const had = current !== null
    current = readStored()
    if (had && current === null) ended('elsewhere')
  })
}

export function setSession(credential: SessionCredential): void {
  current = { accessToken: credential.accessToken, tokenType: credential.tokenType }
  expected = null
  writeStored(current)
}

/**
 * Ends the session in this browser. `reason` says why when it was not this
 * tab's own sign-out (the default, which says nothing). A reason announced
 * beforehand with `expectSessionEnd` wins: the first refused request after
 * the user's own new password reads as that, not as a refusal.
 */
export function clearSession(reason: SessionEnd | 'signed-out' = 'signed-out'): void {
  const had = current !== null
  const why = expected ?? reason
  expected = null
  current = null
  writeStored(null)
  if (had) ended(why)
}

/**
 * The next end of the session is this tab's doing: sign-out (`signed-out`,
 * said nothing about), or a save of the user's own password. `null` withdraws
 * it — the save failed.
 */
export function expectSessionEnd(reason: SessionEnd | 'signed-out' | null): void {
  expected = reason
}

/** Hear when the session ends without this tab signing out. Returns the unsubscribe. */
export function onSessionEnd(listener: (reason: SessionEnd) => void): () => void {
  endListeners.add(listener)
  return () => endListeners.delete(listener)
}

export function hasSession(): boolean {
  return current !== null
}

/** The `Authorization` header value, or null when no one is signed in. */
export function authorizationHeader(): string | null {
  return current === null ? null : `${current.tokenType} ${current.accessToken}`
}

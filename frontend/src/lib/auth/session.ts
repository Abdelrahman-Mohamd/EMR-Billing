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

let current: SessionCredential | null = readStored()

if (typeof window !== 'undefined') {
  // Another tab signed in or out (storage.clear() reports a null key).
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) current = readStored()
  })
}

export function setSession(credential: SessionCredential): void {
  current = { accessToken: credential.accessToken, tokenType: credential.tokenType }
  writeStored(current)
}

export function clearSession(): void {
  current = null
  writeStored(null)
}

export function hasSession(): boolean {
  return current !== null
}

/** The `Authorization` header value, or null when no one is signed in. */
export function authorizationHeader(): string | null {
  return current === null ? null : `${current.tokenType} ${current.accessToken}`
}

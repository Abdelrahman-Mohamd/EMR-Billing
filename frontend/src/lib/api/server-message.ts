import { z } from 'zod'

/**
 * A write's answer, read for the one thing the screens show from it: the
 * server's own `message` ("Practice created successfully"), shown in
 * preference to any wording of ours (the user's decision, 2026-10-07). The
 * backend answers writes `{ success, message, data: null }`; anything else —
 * no body (204), no message — reads as `null`, and the screen says it in its
 * own words. Never fails: a write that succeeded is not turned into an error
 * by the shape of its answer.
 */
export const serverMessageSchema = z.unknown().transform((body): string | null => {
  if (typeof body !== 'object' || body === null) return null
  const message = (body as Record<string, unknown>).message
  return typeof message === 'string' && message.trim() !== '' ? message.trim() : null
})

/** What a write resolves with: the server's message, or `null` when it sent none. */
export type ServerMessage = string | null

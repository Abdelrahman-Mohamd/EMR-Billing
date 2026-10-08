import type { z } from 'zod'
import { authorizationHeader, clearSession } from '@/lib/auth/session'
import { env } from '@/lib/config/env'
import { ApiError, type FieldError } from './api-error'

/**
 * The only place in the app allowed to call `fetch` (enforced by lint).
 *
 * Responsibilities: build the URL, carry the session (the access token, as
 * `Authorization: Bearer …`), time the request out,
 * normalize every failure into `ApiError`, and validate the response body
 * against a schema before it reaches a feature. Nothing else — no caching, no
 * retries, no toasts. Those belong to TanStack Query.
 *
 * The backend is a Laravel API (`/api/v1`, sign-in confirmed 2026-10-07): a
 * Bearer token in the `Authorization` header carries the session, and errors
 * come back as `{ message, errors? }`. Other conventions below are still
 * provisional (docs/FRONTEND_ARCHITECTURE.md "API").
 */

const DEFAULT_TIMEOUT_MS = 20_000

export interface RequestOptions<TResponse> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Path only, e.g. "/claims/123". The base URL comes from env. */
  path: string
  /** Serialized as JSON. */
  body?: unknown
  /** Values that are `undefined` are dropped. Never put PHI in a query string. */
  searchParams?: Record<string, string | number | boolean | undefined>
  /**
   * Schema the response body must satisfy. A 2xx body that fails it is an
   * `ApiError` of kind "contract" — a broken contract is a failed request, not
   * a value the UI has to defend against. Pass `undefined` for 204s.
   */
  schema?: z.ZodType<TResponse>
  /** From TanStack Query, so a stale request is dropped rather than applied. */
  signal?: AbortSignal
  timeoutMs?: number
  headers?: Record<string, string>
}

function buildUrl(path: string, searchParams: RequestOptions<unknown>['searchParams']): string {
  const url = new URL(path.replace(/^\//, ''), `${env.apiBaseUrl.replace(/\/$/, '')}/`)
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/**
 * The error bodies seen so far. The billing backend (Laravel, observed on
 * staging 2026-10-07): `{ message, errors: { field: ["…"] } }` for a 422, and
 * `{ success: false, message, errors: [] }` for a refused sign-in. Also the
 * FastAPI-style `{ detail }` the EMR backend returns. Anything else yields no
 * message, and the caller falls back to one of its own.
 *
 * The server's `message` is kept even when it comes with field errors: it says
 * what the problem is ("A practice must have at least one location; this is
 * its last one."), and an error on no form field has nothing else to show.
 */
function readErrorBody(body: unknown): { message?: string; fieldErrors?: FieldError[] } {
  if (typeof body !== 'object' || body === null) return {}
  const record = body as Record<string, unknown>
  const message =
    typeof record.message === 'string' && record.message.trim() !== '' ? record.message.trim() : undefined
  if (typeof record.errors === 'object' && record.errors !== null && !Array.isArray(record.errors)) {
    const fieldErrors = Object.entries(record.errors as Record<string, unknown>).flatMap(
      ([path, messages]): FieldError[] => {
        const first: unknown = Array.isArray(messages) ? messages[0] : messages
        return typeof first === 'string' ? [{ path, message: first }] : []
      },
    )
    if (fieldErrors.length > 0) return { message: message ?? 'Some fields need attention.', fieldErrors }
  }
  if (message !== undefined) return { message }
  if (typeof record.detail === 'string') return { message: record.detail }
  if (Array.isArray(record.detail)) {
    const fieldErrors = record.detail.flatMap((item): FieldError[] => {
      if (typeof item !== 'object' || item === null) return []
      const issue = item as { loc?: unknown; msg?: unknown }
      if (!Array.isArray(issue.loc) || typeof issue.msg !== 'string') return []
      return [{ path: issue.loc.filter((part) => typeof part === 'string').join('.'), message: issue.msg }]
    })
    return { message: 'Some fields need attention.', fieldErrors }
  }
  return {}
}

/**
 * Server text that is about the server, not for a user: Laravel's
 * "No query results for model [App\Models\Practice] 5" and "The route … could
 * not be found." A 5xx's text is never shown either — with debugging on it
 * can carry an exception, even query data.
 */
const TECHNICAL = [/^No query results for model\b/, /^The route .* could not be found\.?$/]

function showableServerMessage(status: number, message: string | undefined): string | undefined {
  if (message === undefined || status >= 500) return undefined
  return TECHNICAL.some((pattern) => pattern.test(message)) ? undefined : message
}

function errorKindFor(status: number): ApiError['kind'] {
  if (status === 401) return 'unauthenticated'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409 || status === 412) return 'conflict'
  if (status === 400 || status === 422) return 'validation'
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'unavailable'
  if (status >= 500) return 'server'
  return 'unknown'
}

export async function request<TResponse = void>(options: RequestOptions<TResponse>): Promise<TResponse> {
  if (!env.isLive) {
    throw new ApiError({
      kind: 'unavailable',
      message: 'This service is not available right now.',
      detail: `No backend is configured (VITE_API_BASE_URL is empty); ${options.method ?? 'GET'} ${options.path} was not sent.`,
    })
  }

  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

  // The signed-in session travels as a header, never in the URL.
  const authorization = authorizationHeader()
  let response: Response
  try {
    response = await fetch(buildUrl(options.path, options.searchParams), {
      method: options.method ?? 'GET',
      // No cookies: the session is the Bearer token below. (The server allows
      // any origin, `*`, which a browser refuses for a request with cookies.)
      credentials: 'omit',
      signal,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(authorization === null ? {} : { Authorization: authorization }),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })
  } catch (cause) {
    const aborted = cause instanceof DOMException && cause.name === 'AbortError'
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError'
    throw new ApiError({
      kind: timedOut || aborted ? 'timeout' : 'network',
      message: timedOut ? 'The server took too long to respond.' : 'Could not reach the server.',
      detail: cause instanceof Error ? cause.message : undefined,
      cause,
    })
  }

  const requestId = response.headers.get('x-request-id') ?? undefined

  if (!response.ok) {
    // The token this request carried is no longer accepted: the session is
    // over. The route guard sends the user to sign in on their next step.
    if (response.status === 401 && authorization !== null) clearSession()
    const raw: unknown = await response.json().catch(() => undefined)
    const { message, fieldErrors } = readErrorBody(raw)
    const kind = errorKindFor(response.status)
    throw new ApiError({
      kind,
      // A validation message is shown to the user as it is, so an unparsed
      // body must not fall back to "Request failed (422)."
      message:
        message ??
        (kind === 'validation' ? 'Some fields need attention.' : `Request failed (${response.status}).`),
      status: response.status,
      fieldErrors,
      requestId,
      serverMessage: showableServerMessage(response.status, message),
      detail: `${options.method ?? 'GET'} ${options.path} -> ${response.status}`,
    })
  }

  if (options.schema === undefined) return undefined as TResponse

  const raw: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  const validated = options.schema.safeParse(raw)
  if (!validated.success) {
    throw new ApiError({
      kind: 'contract',
      message: 'Something went wrong. Please try again.',
      status: response.status,
      requestId,
      // Paths only. A contract error must not copy the payload into a log.
      detail: `Response did not match its schema at: ${validated.error.issues
        .map((issue) => (issue.path.length > 0 ? issue.path.join('.') : '(root)'))
        .join(', ')}`,
    })
  }
  return validated.data
}

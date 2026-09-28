import type { z } from 'zod'
import { env } from '@/lib/config/env'
import { ApiError, type FieldError } from './api-error'

/**
 * The only place in the app allowed to call `fetch` (enforced by lint).
 *
 * Responsibilities: build the URL, carry the session, time the request out,
 * normalize every failure into `ApiError`, and validate the response body
 * against a schema before it reaches a feature. Nothing else — no caching, no
 * retries, no toasts. Those belong to TanStack Query.
 *
 * No backend exists yet, so the request/response conventions below are
 * PROVISIONAL and marked as such in docs/FRONTEND_ARCHITECTURE.md "API".
 * When the contract lands, this file changes and features do not.
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

/** Provisional: FastAPI-style `{ detail }`, which is what the EMR backend returns. */
function readErrorBody(body: unknown): { message?: string; fieldErrors?: FieldError[] } {
  if (typeof body !== 'object' || body === null) return {}
  const record = body as Record<string, unknown>
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
      detail: `No backend is configured (VITE_DATA_SOURCE=${env.dataSource}). This build uses the mock data layer; ${options.method ?? 'GET'} ${options.path} was not sent.`,
    })
  }

  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(buildUrl(options.path, options.searchParams), {
      method: options.method ?? 'GET',
      // The session is an httpOnly cookie the JS never reads. See
      // docs/SECURITY.md "Session handling" — provisional until auth exists.
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
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
      detail: `${options.method ?? 'GET'} ${options.path} -> ${response.status}`,
    })
  }

  if (options.schema === undefined) return undefined as TResponse

  const raw: unknown = response.status === 204 ? undefined : await response.json()
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

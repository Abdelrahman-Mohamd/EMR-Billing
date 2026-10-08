/**
 * One error type for everything that can go wrong between a component and a
 * server. Call sites branch on `kind`, never on a status number scattered
 * through the UI, and never on a message string.
 *
 * `message` is safe to show a user. `serverMessage` is what the server itself
 * said, word for word — shown in preference to any wording of ours (the
 * user's decision, 2026-10-07: the server's message says what the problem
 * is). It is kept only from a 4xx, and not when it is technical (see
 * lib/api/http-client.ts). Anything a user must not see (stack, payload)
 * stays in `detail`, which is for logs and devtools only. See
 * docs/SECURITY.md "Error messages".
 */
export type ApiErrorKind =
  /** No response: offline, DNS, CORS, connection reset. */
  | 'network'
  /** The request exceeded the client timeout or was cancelled by the caller. */
  | 'timeout'
  /** 401 — no session, or the session expired. */
  | 'unauthenticated'
  /** 403 — signed in, but not allowed. The backend decided this, not the UI. */
  | 'forbidden'
  /** 404 — the record does not exist, or is not visible to this user. */
  | 'not_found'
  /** 409 / 412 — someone else changed the record first. */
  | 'conflict'
  /** 422 / 400 with field errors the form should display. */
  | 'validation'
  /** 429 — rate limited. */
  | 'rate_limited'
  /** 5xx. */
  | 'server'
  /**
   * 503, or no server configured at all. Distinct from `server` because the
   * right message is "try again later", not "something broke".
   */
  | 'unavailable'
  /** A 2xx body that did not match its schema: treat as a failed request. */
  | 'contract'
  /** Anything unclassified. */
  | 'unknown'

export interface FieldError {
  /** Dotted path into the submitted payload, e.g. "guarantor.address.zip". */
  path: string
  message: string
}

export interface ApiErrorOptions {
  kind: ApiErrorKind
  message: string
  status?: number | undefined
  /** Developer-facing detail. Never rendered. */
  detail?: string | undefined
  /** Present for `validation`, so a form can map errors onto its fields. */
  fieldErrors?: FieldError[] | undefined
  /** Correlation id from the response, quoted to support when present. */
  requestId?: string | undefined
  /** The server's own message, to show the user as it is. */
  serverMessage?: string | undefined
  cause?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly detail: string | undefined
  readonly fieldErrors: FieldError[]
  readonly requestId: string | undefined
  readonly serverMessage: string | undefined

  constructor(options: ApiErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ApiError'
    this.kind = options.kind
    this.status = options.status
    this.detail = options.detail
    this.fieldErrors = options.fieldErrors ?? []
    this.requestId = options.requestId
    this.serverMessage = options.serverMessage
  }

  /** Retrying can plausibly help. Used by the query client's retry policy. */
  get isRetryable(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      this.kind === 'server' ||
      // A server that said 503 may come back; "no endpoint yet" or "no backend
      // configured" (no status — nothing was sent) will not, so it fails at once.
      (this.kind === 'unavailable' && this.status !== undefined)
    )
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * The message shown to a user: the server's own, when it sent one; otherwise
 * ours, by kind (no response, a timeout, a technical or empty answer).
 */
export function userMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.'
  if (error.serverMessage !== undefined) return error.serverMessage
  switch (error.kind) {
    case 'network':
      return 'Could not reach the server. Check your connection and try again.'
    case 'timeout':
      return 'The server took too long to respond. Please try again.'
    case 'unauthenticated':
      return 'Your session has ended. Please sign in again.'
    case 'forbidden':
      return 'You do not have access to this.'
    case 'not_found':
      return 'This record could not be found.'
    case 'conflict':
      return 'Someone else changed this record. Reload and try again.'
    case 'validation':
      return error.message
    case 'rate_limited':
      return 'Too many requests. Please wait a moment and try again.'
    case 'unavailable':
      return 'This service is not available right now. Please try again later.'
    case 'server':
    case 'contract':
    case 'unknown':
      return 'Something went wrong. Please try again.'
  }
}

/**
 * A server's field errors name backend fields (`payer_id`); a form names its
 * own (`payerId`). Returns the error with its paths renamed, so
 * `applyServerErrors` lands each message on the right input. With a map of
 * `names`, only the first segment of a dotted path is renamed (`address.zip`
 * stays nested); a function renames the whole path, for a form whose nesting
 * differs from the payload's (`locations.0.code` → `location.code`). Anything
 * that is not an ApiError, or carries no field errors, passes through.
 */
export function renameFieldErrors(
  error: unknown,
  names: Readonly<Record<string, string>> | ((path: string) => string),
): unknown {
  if (!isApiError(error) || error.fieldErrors.length === 0) return error
  const rename =
    typeof names === 'function'
      ? names
      : (path: string) => {
          const [head = '', ...rest] = path.split('.')
          return [names[head] ?? head, ...rest].join('.')
        }
  return new ApiError({
    kind: error.kind,
    message: error.message,
    status: error.status,
    detail: error.detail,
    requestId: error.requestId,
    serverMessage: error.serverMessage,
    fieldErrors: error.fieldErrors.map((fieldError) => ({ ...fieldError, path: rename(fieldError.path) })),
    cause: error,
  })
}

/**
 * One error type for everything that can go wrong between a component and a
 * server. Call sites branch on `kind`, never on a status number scattered
 * through the UI, and never on a message string.
 *
 * `message` is safe to show a user. Anything a user must not see (raw server
 * text, stack, payload) stays in `detail`, which is for logs and devtools only.
 * See docs/SECURITY.md "Error messages".
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
  cause?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly detail: string | undefined
  readonly fieldErrors: FieldError[]
  readonly requestId: string | undefined

  constructor(options: ApiErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ApiError'
    this.kind = options.kind
    this.status = options.status
    this.detail = options.detail
    this.fieldErrors = options.fieldErrors ?? []
    this.requestId = options.requestId
  }

  /** Retrying can plausibly help. Used by the query client's retry policy. */
  get isRetryable(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      this.kind === 'server' ||
      this.kind === 'unavailable'
    )
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** The message shown to a user for an error of this kind. */
export function userMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.'
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
 * own (`payerId`). Returns the error with its paths renamed through `names`, so
 * `applyServerErrors` lands each message on the right input. Only the first
 * segment of a dotted path is renamed (`address.zip` stays nested). Anything
 * that is not an ApiError, or carries no field errors, passes through.
 */
export function renameFieldErrors(error: unknown, names: Readonly<Record<string, string>>): unknown {
  if (!isApiError(error) || error.fieldErrors.length === 0) return error
  return new ApiError({
    kind: error.kind,
    message: error.message,
    status: error.status,
    detail: error.detail,
    requestId: error.requestId,
    fieldErrors: error.fieldErrors.map((fieldError) => {
      const [head = '', ...rest] = fieldError.path.split('.')
      return { ...fieldError, path: [names[head] ?? head, ...rest].join('.') }
    }),
    cause: error,
  })
}

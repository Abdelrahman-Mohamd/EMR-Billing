import { request } from '@/lib/api/http-client'
import { MAX_PER_PAGE } from '@/lib/api/pagination'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import type { BillingException } from '../model/billing-exception'
import {
  billingExceptionPageResponseSchema,
  groupedResponseSchema,
  reprocessResponseSchema,
  scanResponseSchema,
  type ExceptionGroups,
  type ReprocessResult,
  type ScanResult,
} from '../schemas/billing-exception'

/**
 * Billing exceptions' only door to a server. **Live** (contract given
 * 2026-10-19), carrying the session's token: `GET /billing-exceptions`, `GET
 * /billing-exceptions/grouped`, `POST /billing-exceptions/scan`, `POST
 * /billing-exceptions/{id}/reprocess` and `DELETE`. Shapes in
 * schemas/billing-exception.ts.
 */

/** Which exceptions a list asks for; the server filters them. Left empty: all. */
export interface ExceptionFilter {
  practiceId?: number
  /** `patient`, `case` or `charge`. */
  type?: string
  /** A reason code, e.g. `zip_state_mismatch`. */
  reason?: string
}

const params = (filter: ExceptionFilter) => ({
  practice_id: filter.practiceId,
  type: filter.type,
  reason: filter.reason,
})

export interface BillingExceptionsApi {
  list: (
    page: number,
    filter: ExceptionFilter,
    signal?: AbortSignal,
  ) => Promise<{ exceptions: BillingException[]; pageCount: number }>
  grouped: (filter: ExceptionFilter, signal?: AbortSignal) => Promise<ExceptionGroups>
  scan: (practiceId: number) => Promise<ScanResult>
  reprocess: (id: number) => Promise<ReprocessResult>
  remove: (id: number) => Promise<ServerMessage>
}

const path = (id: number) => `/billing-exceptions/${encodeURIComponent(String(id))}`

const live: BillingExceptionsApi = {
  list: (page, filter, signal) =>
    request({
      method: 'GET',
      path: '/billing-exceptions',
      searchParams: { page, per_page: MAX_PER_PAGE, ...params(filter) },
      schema: billingExceptionPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  grouped: (filter, signal) =>
    request({
      method: 'GET',
      path: '/billing-exceptions/grouped',
      searchParams: params(filter),
      schema: groupedResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  scan: (practiceId) =>
    request({
      method: 'POST',
      path: '/billing-exceptions/scan',
      body: { practice_id: practiceId },
      schema: scanResponseSchema,
    }),
  reprocess: (id) =>
    request({ method: 'POST', path: `${path(id)}/reprocess`, schema: reprocessResponseSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
}

function backend(): Promise<BillingExceptionsApi> {
  return Promise.resolve(live)
}

/**
 * The exceptions the filter asks for, newest first. The list is paged by the
 * server, so this reads page 1, then the rest at once.
 */
export async function listBillingExceptions(
  filter: ExceptionFilter = {},
  signal?: AbortSignal,
): Promise<BillingException[]> {
  const api = await backend()
  const first = await api.list(1, filter, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, filter, signal)),
  )
  return [first, ...rest].flatMap((page) => page.exceptions)
}

/** The queue by type, then reason, with counts. */
export async function getExceptionGroups(
  filter: ExceptionFilter = {},
  signal?: AbortSignal,
): Promise<ExceptionGroups> {
  return (await backend()).grouped(filter, signal)
}

/** Re-checks a whole practice: every patient and case, and every visit in review. */
export async function scanPractice(practiceId: number): Promise<ScanResult> {
  return (await backend()).scan(practiceId)
}

/** Re-checks the exception's record now. */
export async function reprocessBillingException(id: number): Promise<ReprocessResult> {
  return (await backend()).reprocess(id)
}

export async function deleteBillingException(id: number): Promise<ServerMessage> {
  return (await backend()).remove(id)
}

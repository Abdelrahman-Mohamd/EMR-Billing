import { request } from '@/lib/api/http-client'
import {
  auditEntryDetailResponseSchema,
  auditPageResponseSchema,
  type AuditEntryDetail,
  type AuditLogQuery,
  type AuditPage,
} from '../schemas/audit-entry'

/**
 * The audit log's only door to a server. Read-only: nothing here can change
 * an entry.
 *
 * **Live** (contracts confirmed 2026-10-07), carrying the session's token:
 * - `GET /activity-logs?page=N[&log_name=visits]` answers one page of 15
 *   entries, newest first, with Laravel's `meta` for the pager — of one module
 *   when `log_name` is sent (schemas/audit-entry.ts `AuditLogQuery`).
 * - `GET /activity-logs/{id}` answers one entry; an unknown id is a `404`.
 *
 * See schemas/audit-entry.ts for both shapes. With no backend configured (the
 * tests), the calls reject as `unavailable` without being sent.
 */
export interface AuditLogApi {
  list: (query: AuditLogQuery, signal?: AbortSignal) => Promise<AuditPage>
  get: (id: string, signal?: AbortSignal) => Promise<AuditEntryDetail>
}

const live: AuditLogApi = {
  list: (query, signal) =>
    request({
      method: 'GET',
      path: '/activity-logs',
      searchParams: { page: query.page, log_name: query.module },
      schema: auditPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/activity-logs/${encodeURIComponent(id)}`,
      schema: auditEntryDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
}

function backend(): Promise<AuditLogApi> {
  return Promise.resolve(live)
}

export async function listAuditEntries(query: AuditLogQuery, signal?: AbortSignal): Promise<AuditPage> {
  return (await backend()).list(query, signal)
}

export async function getAuditEntry(id: string, signal?: AbortSignal): Promise<AuditEntryDetail> {
  return (await backend()).get(id, signal)
}

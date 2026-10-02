import { ApiError } from '@/lib/api/api-error'
import { auditPageResponseSchema, type AuditLogQuery, type AuditPage } from '../schemas/audit-entry'

/**
 * The audit log's only door to a server. Read-only: the prototype offers no
 * way to change an entry, so nothing here can.
 *
 * **No endpoint, parameters or response exist yet.** The screen hands over an
 * `AuditLogQuery` (search, modules, page) and expects one page back; how that
 * becomes a request is written here once the contract is known. Searching,
 * filtering and paging are the server's, so the browser never loads the whole
 * history. In development and tests the call goes to an in-memory mock that
 * plays the server (ADR 0006); in any other build it rejects as `unavailable`.
 */
export interface AuditLogApi {
  list: (query: AuditLogQuery, signal?: AbortSignal) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'The audit log is not available right now.',
      detail:
        'No audit log endpoint exists yet. features/admin-audit-log/api/audit-log-api.ts is the integration point.',
    }),
  )

const live: AuditLogApi = { list: notConnected }

async function backend(): Promise<AuditLogApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./audit-log-api.mock')).mockAuditLogApi
  return live
}

export async function listAuditEntries(query: AuditLogQuery, signal?: AbortSignal): Promise<AuditPage> {
  return auditPageResponseSchema.parse(await (await backend()).list(query, signal))
}

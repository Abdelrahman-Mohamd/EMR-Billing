import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getAuditEntry, listAuditEntries } from '../api/audit-log-api'
import type { AuditLogQuery } from '../schemas/audit-entry'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const auditLogKeys = {
  all: ['audit-log'] as const,
  page: (query: AuditLogQuery) => [...auditLogKeys.all, 'page', query] as const,
  entry: (id: string) => [...auditLogKeys.all, 'entry', id] as const,
}

/**
 * One page of the audit log. The previous page stays on screen while the next
 * one loads, so paging does not flash an empty table.
 */
export function useAuditLog(query: AuditLogQuery) {
  return useQuery({
    queryKey: auditLogKeys.page(query),
    queryFn: ({ signal }) => listAuditEntries(query, signal),
    placeholderData: keepPreviousData,
  })
}

/** One entry in full. An entry never changes, so once loaded it is not asked for again. */
export function useAuditEntry(id: string) {
  return useQuery({
    queryKey: auditLogKeys.entry(id),
    queryFn: ({ signal }) => getAuditEntry(id, signal),
    staleTime: Infinity,
  })
}

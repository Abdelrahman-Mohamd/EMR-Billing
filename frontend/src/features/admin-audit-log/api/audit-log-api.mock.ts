import type { AuditLogApi } from './audit-log-api'

/**
 * An in-memory audit log for development and demos (ADR 0006). Never part of
 * a production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it searches (action, detail or user, as the
 * prototype's search does), filters by module and returns one page, newest
 * first, in the provisional shape of `schemas/audit-entry.ts`.
 *
 * Invented data only: actions written the way the prototype logs them, by the
 * prototype's fictional users, on fictional records. Timestamps are relative
 * to now so "Today" and "Yesterday" can be seen.
 */
const LATENCY_MS = 250

const TEMPLATES: ReadonlyArray<{ user: string; action: string; module: string; detail: string }> = [
  {
    user: 'EMR import',
    action: 'Session received from EMR',
    module: 'CHARGES',
    detail: 'Record EMR-N-5590231 · 3 charge lines',
  },
  { user: 'Tomás Herrera', action: 'Visit released for claiming', module: 'CHARGES', detail: '' },
  {
    user: 'Scheduled submission job',
    action: 'Claim submitted to Waystar (EDI 837P)',
    module: 'BILLING',
    detail: 'Aetna · $118.00 · ref WS20260930-041',
  },
  {
    user: 'Tomás Herrera',
    action: 'Claim held — Authorization hold',
    module: 'BILLING',
    detail: 'No authorization with an active date range and remaining visits for this date of service.',
  },
  {
    user: 'Dana Whitfield',
    action: 'Payment posted',
    module: 'PAYMENTS',
    detail: 'Medicare Part B paid $96.40 · batch 13202-835-260929',
  },
  {
    user: 'Keisha Morgan',
    action: 'Appeal submitted',
    module: 'DENIALS',
    detail: 'Payer portal · Medical necessity letter attached',
  },
  {
    user: 'Owen Park',
    action: 'Payer SLA exceeded — cloned into Denial & A/R (Delayed)',
    module: 'AR',
    detail: 'SLA due 09/15/2026, no payment acknowledgement',
  },
  {
    user: 'Tomás Herrera',
    action: 'Coverage added',
    module: 'PATIENT',
    detail: 'Empire BlueCross BlueShield',
  },
  {
    user: 'Dana Whitfield',
    action: 'Insurance updated',
    module: 'ADMIN',
    detail: 'Corvel Enterprise · audit required',
  },
  { user: 'Ivy Bennett', action: 'Integration requested', module: 'INTEGRATION', detail: 'Bay Ridge' },
  { user: 'Dana Whitfield', action: 'Period closed', module: 'MONTHEND', detail: 'August 2026' },
  { user: 'Dana Whitfield', action: 'Signed in', module: '', detail: 'System Admin' },
]

// 57 entries, one every 97 minutes back from now: three pages at 20 a page.
const entries = Array.from({ length: 57 }, (_, index) => {
  const template = TEMPLATES[index % TEMPLATES.length] ?? TEMPLATES[0]
  return {
    id: `au${1057 - index}`,
    at: new Date(Date.now() - index * 97 * 60_000).toISOString(),
    user_name: template?.user ?? '',
    action: template?.action ?? '',
    detail: template?.detail ?? '',
    module: template?.module ?? '',
  }
})

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

export const mockAuditLogApi: AuditLogApi = {
  async list(query) {
    await wait()
    const search = query.search.trim().toLowerCase()
    const matching = entries.filter(
      (entry) =>
        (query.modules.length === 0 || query.modules.includes(entry.module)) &&
        (search === '' ||
          `${entry.action} ${entry.detail} ${entry.user_name}`.toLowerCase().includes(search)),
    )
    const start = (query.page - 1) * query.pageSize
    return {
      entries: matching.slice(start, start + query.pageSize).map((entry) => ({ ...entry })),
      total: matching.length,
    }
  },
}

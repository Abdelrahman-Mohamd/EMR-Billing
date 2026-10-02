import { z } from 'zod'

/**
 * One audit-log entry and one page of them, as the screen reads them.
 *
 * **Provisional — no backend contract exists** (the open question Q-053 asks
 * what the audit trail records). The fields are what the prototype's Audit
 * log shows, and no more: when, who, the action with its detail, the module.
 * The wire names below are placeholders chosen for this file; when the real
 * response is known, this file and `api/` change — nothing else.
 *
 * Deliberately left out: the prototype's link to the affected record (its
 * `entity_type` / `entity_id`). The screens it opens — claims, visits,
 * denials, exceptions — do not exist in this frontend yet.
 */
export const auditEntryResponseSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    /** A timestamp; its format is not defined — see lib/utils/format-when.ts. */
    at: z.string(),
    /** The prototype shows the user's name; how the backend identifies the user is not known. */
    user_name: z.string(),
    action: z.string(),
    detail: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? ''),
    // A string, not an enum: a module the frontend does not know yet must not
    // make the page fail to load.
    module: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? ''),
  })
  .transform((wire) => ({
    id: wire.id,
    at: wire.at,
    userName: wire.user_name,
    action: wire.action,
    detail: wire.detail,
    module: wire.module,
  }))

export type AuditEntry = z.output<typeof auditEntryResponseSchema>

/** A page of entries and how many match in all — the least the prototype's pager needs. */
export const auditPageResponseSchema = z.object({
  entries: z.array(auditEntryResponseSchema),
  total: z.number().int().nonnegative(),
})

export type AuditPage = z.output<typeof auditPageResponseSchema>

/**
 * What the screen asks for: the prototype's search (action, detail or user),
 * its module filter, and a page. How these reach the server — parameter
 * names, offset or page number — is the api layer's to translate once known.
 */
export interface AuditLogQuery {
  search: string
  modules: readonly string[]
  page: number
  pageSize: number
}

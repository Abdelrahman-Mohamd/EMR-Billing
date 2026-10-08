import { z } from 'zod'

/**
 * Activity-log entries, as the backend sends them (contracts confirmed
 * 2026-10-07):
 *
 * - `GET /activity-logs?page=N` → `{ data: { data: [entry…], links, meta: {
 *   current_page, last_page, per_page, from, to, total, … } } }`, newest
 *   first, 15 a page;
 * - `GET /activity-logs/{id}` → `{ data: entry }`; an unknown id is a `404`.
 *
 * An entry is `{ id, log_name, event, description, subject_type, subject_id,
 * causer: { id, name, email } | null, changes: { old, attributes },
 * properties: { ip_address, email? }, batch_uuid, created_at }`.
 *
 * The list keeps: when (`created_at`), who (`causer.name`; a failed sign-in
 * has no causer), what (`description`), a one-line detail (the email a failed
 * sign-in was tried with, the names of changed fields — never their values —
 * and the IP address) and the module (`log_name`). The detail keeps all of
 * it: every property, the affected record, the batch, and each changed field
 * before and after. Values are shown as text, whatever their type.
 *
 * Laravel sends an empty `properties` or `changes` as `[]` rather than `{}`,
 * so both are read leniently: anything that is not an object counts as empty.
 */
const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const looseObject = z.unknown().transform(asRecord)

const capitalise = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Any value as one line of text; nothing at all as ''. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/** "subject_type" → "Subject type". */
const sentence = (key: string): string => capitalise(key.replace(/[_-]+/g, ' ').trim())

/** Field and property names the backend has been seen to send, with a better label than their key. */
const LABELS: Readonly<Record<string, string>> = { ip_address: 'IP address' }
const labelFor = (key: string): string => LABELS[key] ?? sentence(key)

const activityWireSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  // Strings, not enums: a log name or event the frontend does not know yet
  // must not make the page fail to load.
  log_name: z.string().nullable().optional(),
  event: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  subject_id: z.union([z.string(), z.number()]).nullable().optional(),
  causer: z
    .object({ name: z.string().nullable().optional(), email: z.string().nullable().optional() })
    .nullable()
    .optional(),
  changes: looseObject.optional(),
  properties: looseObject.optional(),
  batch_uuid: z.string().nullable().optional(),
  created_at: z.string(),
})

type ActivityWire = z.output<typeof activityWireSchema>

function toEntry(wire: ActivityWire) {
  const properties = wire.properties ?? {}
  const changed = Object.keys(asRecord(wire.changes?.attributes))
  const ipAddress = text(properties.ip_address)
  return {
    id: wire.id,
    at: wire.created_at,
    /** Who did it; empty when no one was signed in (a failed sign-in). */
    userName: wire.causer?.name?.trim() ?? '',
    // The server's wording, with a capital: "updated" → "Updated".
    action: capitalise(wire.description?.trim() || wire.event?.trim() || ''),
    event: wire.event ?? '',
    detail: [
      text(properties.email),
      changed.length > 0 ? `Changed ${changed.join(', ')}` : '',
      ipAddress === '' ? '' : `IP ${ipAddress}`,
    ]
      .filter((part) => part !== '')
      .join(' · '),
    module: wire.log_name ?? '',
  }
}

export const auditEntryResponseSchema = activityWireSchema.transform(toEntry)

export type AuditEntry = z.output<typeof auditEntryResponseSchema>

function toDetail(wire: ActivityWire) {
  const old = asRecord(wire.changes?.old)
  const attributes = asRecord(wire.changes?.attributes)
  // New values' order first, then any field that only has an old value.
  const fields = [...new Set([...Object.keys(attributes), ...Object.keys(old)])]
  const subjectType = text(wire.subject_type)
  const subjectId = displayValue(wire.subject_id)
  return {
    ...toEntry(wire),
    /** Null when no one was signed in. */
    user:
      wire.causer === null || wire.causer === undefined
        ? null
        : { name: wire.causer.name?.trim() ?? '', email: wire.causer.email?.trim() ?? '' },
    properties: Object.entries(wire.properties ?? {}).map(([key, value]) => ({
      key,
      label: labelFor(key),
      value: displayValue(value),
    })),
    /** "User #1"; '' when the entry is about no record. */
    record:
      subjectType === ''
        ? ''
        : subjectId === ''
          ? sentence(subjectType)
          : `${sentence(subjectType)} #${subjectId}`,
    batch: text(wire.batch_uuid),
    changes: fields.map((field) => ({
      field,
      label: labelFor(field),
      before: displayValue(old[field]),
      after: displayValue(attributes[field]),
    })),
  }
}

export const auditEntryDetailResponseSchema = z
  .object({ data: activityWireSchema.transform(toDetail) })
  .transform((wire) => wire.data)

export type AuditEntryDetail = z.output<typeof auditEntryDetailResponseSchema>

export const auditPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(auditEntryResponseSchema),
      meta: z.object({
        current_page: z.number().int().positive(),
        last_page: z.number().int().positive(),
        per_page: z.number().int().positive(),
        from: z.number().int().nullable().optional(),
        to: z.number().int().nullable().optional(),
        total: z.number().int().nonnegative(),
      }),
    }),
  })
  .transform(({ data }) => ({
    entries: data.data,
    page: data.meta.current_page,
    pageCount: data.meta.last_page,
    total: data.meta.total,
    from: data.meta.from ?? 0,
    to: data.meta.to ?? 0,
  }))

export type AuditPage = z.output<typeof auditPageResponseSchema>

/**
 * What the screen asks for: a page. The endpoint's contract has no search or
 * filter, and the page size is the server's (15).
 */
export interface AuditLogQuery {
  page: number
}

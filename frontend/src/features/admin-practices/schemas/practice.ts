import { z } from 'zod'

/**
 * Practices and locations as the screens see them, parsed from the wire.
 *
 * - `GET /practices?page=N` (confirmed 2026-10-07) → Laravel pagination of
 *   **summaries**: `{ id, organization_id, code, name, npi, tax_id,
 *   taxonomy_code, is_active, organization: { id, name, is_active,
 *   created_at } | null, locations_count, created_at }` — no DBA, address or
 *   locations.
 * - `GET /practices/{id}` (confirmed 2026-10-07) → the whole practice: the summary's fields plus `dba_name`,
 *   `address: { line1, line2, city, state, zip }` and `locations[]`, each
 *   flat — `{ id, practice_id, code, name, npi, address: "<street>", city,
 *   state, zipcode, place_of_service, is_active, created_at, updated_at }`,
 *   as `POST /practices` sends them.
 *
 * The fields are the backend's, nothing more (no legal name, no Tax ID type,
 * no primary flag, no EMR link: the prototype shows those, the backend does
 * not have them). Wire names are snake_case and mapped to camelCase here, the
 * one place that knows both. A location's flat address is read into the same
 * `{ line1, city, state, zip }` the forms use.
 */
const addressWireSchema = z.object({
  line1: z.string(),
  line2: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
})

const toAddress = (wire: z.output<typeof addressWireSchema>) => ({
  line1: wire.line1,
  ...(wire.line2 === null || wire.line2 === undefined || wire.line2 === '' ? {} : { line2: wire.line2 }),
  city: wire.city,
  state: wire.state,
  zip: wire.zip,
})

export type Address = ReturnType<typeof toAddress>

export const locationResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    code: z.string(),
    name: z.string(),
    npi: z.string(),
    /** The street line. */
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zipcode: z.string(),
    place_of_service: z.string().nullable().optional(),
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    code: wire.code,
    name: wire.name,
    npi: wire.npi,
    address: { line1: wire.address, city: wire.city, state: wire.state, zip: wire.zipcode },
    placeOfService: wire.place_of_service ?? undefined,
    isActive: wire.is_active,
  }))

export type Location = z.output<typeof locationResponseSchema>

/**
 * A location as `GET /locations` lists it (confirmed 2026-10-07): `{ id,
 * practice_id, code, name, npi, place_of_service, is_active, practice:
 * { name }, created_at }` — no address. Enough to pick or name a location
 * anywhere in the app.
 */
export const locationSummaryResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    code: z.string(),
    name: z.string(),
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    code: wire.code,
    name: wire.name,
    isActive: wire.is_active,
  }))

export type LocationSummary = z.output<typeof locationSummaryResponseSchema>

export const locationPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(locationSummaryResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ locations: data.data, pageCount: data.meta.last_page }))

/** The organization a practice record names, when it is in one. */
const organizationWireSchema = z.object({ id: z.number().int(), name: z.string() }).nullable().optional()

const summaryWireSchema = z.object({
  id: z.number().int(),
  // PRD V2: an organization is optional — "a practice can stand on its own".
  organization_id: z.number().int().nullable().optional(),
  organization: organizationWireSchema,
  code: z.string(),
  name: z.string(),
  npi: z.string(),
  tax_id: z.string(),
  taxonomy_code: z.string(),
  is_active: z.boolean(),
})

const toSummary = (wire: z.output<typeof summaryWireSchema>) => ({
  id: wire.id,
  organizationId: wire.organization_id ?? null,
  /** Its organization's name, from the record itself; absent when in none. */
  ...(wire.organization ? { organizationName: wire.organization.name } : {}),
  code: wire.code,
  name: wire.name,
  npi: wire.npi,
  taxId: wire.tax_id,
  taxonomyCode: wire.taxonomy_code,
  isActive: wire.is_active,
})

/** A practice as the list has it — enough to pick it and to name it. */
export const practiceSummaryResponseSchema = summaryWireSchema
  .extend({ locations_count: z.number().int().nonnegative() })
  .transform((wire) => ({ ...toSummary(wire), locationsCount: wire.locations_count }))

export type PracticeSummary = z.output<typeof practiceSummaryResponseSchema>

export const practicePageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(practiceSummaryResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({
    practices: data.data,
    page: data.meta.current_page,
    pageCount: data.meta.last_page,
  }))

export type PracticePage = z.output<typeof practicePageResponseSchema>

/** A practice in full, with its locations. */
export const practiceResponseSchema = summaryWireSchema
  .extend({
    dba_name: z.string().nullable().optional(),
    address: addressWireSchema,
    locations: z.array(locationResponseSchema),
  })
  .transform((wire) => ({
    ...toSummary(wire),
    dbaName: wire.dba_name === null || wire.dba_name === '' ? undefined : wire.dba_name,
    address: toAddress(wire.address),
    locations: wire.locations,
  }))

export type Practice = z.output<typeof practiceResponseSchema>

export const practiceDetailResponseSchema = z
  .object({ data: practiceResponseSchema })
  .transform((wire) => wire.data)

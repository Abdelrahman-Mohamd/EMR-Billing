import { z } from 'zod'

/**
 * Practices and locations as the screens see them, parsed from the wire.
 *
 * The fields are the current backend payloads', field for field — nothing
 * more (no legal name, no Tax ID type, no primary flag, no EMR link: the
 * prototype shows those, the payloads do not have them). Wire names are
 * snake_case and are mapped to camelCase here, the one place that knows both.
 *
 * Known relationships, and only these: a practice points at an optional
 * organization (`organization_id`), a location at its practice
 * (`practice_id`), and a practice carries its locations (`locations[]`).
 *
 * Assumptions about responses, which no contract confirms yet: a saved record
 * comes back as its payload plus a numeric `id`; a practice comes back with its
 * locations, each in the standalone location shape (with `practice_id` and
 * `is_active`). If either is wrong, this file and `api/` change — nothing else.
 */
const addressWireSchema = z.object({
  line1: z.string(),
  // In the practice payload; absent from both location examples.
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
})

export type Address = z.output<typeof addressWireSchema>

export const locationResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    code: z.string(),
    name: z.string(),
    npi: z.string(),
    address: addressWireSchema,
    // The second location in the practice example has none.
    place_of_service: z.string().optional(),
    is_active: z.boolean(),
  })
  .transform((wire) => ({
    id: wire.id,
    practiceId: wire.practice_id,
    code: wire.code,
    name: wire.name,
    npi: wire.npi,
    address: wire.address,
    placeOfService: wire.place_of_service,
    isActive: wire.is_active,
  }))

export type Location = z.output<typeof locationResponseSchema>

export const practiceResponseSchema = z
  .object({
    id: z.number().int(),
    // PRD V2: an organization is optional — "a practice can stand on its own".
    organization_id: z.number().int().nullable().optional(),
    code: z.string(),
    name: z.string(),
    dba_name: z.string().optional(),
    npi: z.string(),
    tax_id: z.string(),
    taxonomy_code: z.string(),
    address: addressWireSchema,
    is_active: z.boolean(),
    locations: z.array(locationResponseSchema),
  })
  .transform((wire) => ({
    id: wire.id,
    organizationId: wire.organization_id ?? null,
    code: wire.code,
    name: wire.name,
    dbaName: wire.dba_name,
    npi: wire.npi,
    taxId: wire.tax_id,
    taxonomyCode: wire.taxonomy_code,
    address: wire.address,
    isActive: wire.is_active,
    locations: wire.locations,
  }))

export type Practice = z.output<typeof practiceResponseSchema>

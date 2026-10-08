/**
 * The request bodies, exactly as the backend payloads show them.
 * `api/payloads.ts` builds them from form values; its tests pin them against
 * the example payloads.
 *
 * Confirmed 2026-10-07 (and tried on staging): the practice's address is an
 * object; a location's is flat — the street as `address`, then `city`,
 * `state`, `zipcode` — with no suite line, inside `POST /practices`'s
 * `locations[]` and on its own (`POST /locations`, `PUT /locations/{id}`).
 *
 * A save (`PUT`) changes only the fields it carries: one left out keeps its
 * value. So a save sends every field, and an emptied DBA as `null` (left out,
 * the old DBA would stay). A location's `place_of_service` cannot be cleared
 * (`null` is refused; a new location without one gets 11), so the form always
 * has one. A location's `practice_id` is sent on create only — a save that
 * carries it is refused ("prohibited"): a location never moves practice.
 *
 * Optional fields are *left out* when empty, as the examples do (the second
 * location has no `place_of_service`, the standalone location no `line2`).
 * Whether an update may clear a field by leaving it out, or needs `null`, is
 * not known yet.
 */
export interface AddressPayload {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
}

/**
 * A location inside a new practice's `locations[]` (confirmed 2026-10-07):
 * flat, the street in `address`; no `practice_id`, no `is_active`.
 */
export interface PracticeLocationPayload {
  code: string
  name: string
  npi: string
  /** The street line. */
  address: string
  city: string
  state: string
  zipcode: string
  place_of_service?: string
}

export interface PracticePayload {
  /** `null`: in no organization (also how a save removes it). */
  organization_id: number | null
  code: string
  name: string
  /** Left out when empty on create; `null` on a save, which clears it. */
  dba_name?: string | null
  npi: string
  tax_id: string
  taxonomy_code: string
  address: AddressPayload
  is_active: boolean
  /** Sent when a practice is created with its first location (BR01). */
  locations?: PracticeLocationPayload[]
}

/** Save one location (`PUT /locations/{id}`): flat, no `practice_id`. */
export interface LocationUpdatePayload extends PracticeLocationPayload {
  is_active: boolean
}

/** Add one location to a practice (`POST /locations`). */
export interface LocationPayload extends LocationUpdatePayload {
  practice_id: number
}

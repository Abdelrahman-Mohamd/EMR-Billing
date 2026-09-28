/**
 * The request bodies, exactly as the current backend payloads show them.
 * `api/payloads.ts` builds them from form values; its tests pin them against
 * the example payloads.
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

/** A location inside a new practice's `locations[]`: no `practice_id`, no `is_active`. */
export interface PracticeLocationPayload {
  code: string
  name: string
  npi: string
  address: AddressPayload
  place_of_service?: string
}

export interface PracticePayload {
  /** `null` for a practice in no organization — an assumption, see `api/payloads.ts`. */
  organization_id: number | null
  code: string
  name: string
  dba_name?: string
  npi: string
  tax_id: string
  taxonomy_code: string
  address: AddressPayload
  is_active: boolean
  /** Sent when a practice is created with its first location (BR01). */
  locations?: PracticeLocationPayload[]
}

export interface LocationPayload {
  practice_id: number
  code: string
  name: string
  npi: string
  address: AddressPayload
  place_of_service?: string
  is_active: boolean
}

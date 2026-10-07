import { z } from 'zod'

/**
 * A visit and its charge lines, as the backend's payload examples define them
 * (2026-10-02) — nothing more:
 *
 * - create a visit: `{ case_id, date_of_service, location_id,
 *   billing_provider_id, treating_provider_id, authorization_id | null,
 *   charge_lines: [{ procedure_code_id, units, modifiers?, diagnosis_pointers? }] }`
 * - add a charge line: `{ visit_id, procedure_code_id, units, modifiers?,
 *   diagnosis_pointers? }`
 *
 * In the examples a line may leave out `modifiers` and `diagnosis_pointers`
 * (the first line has neither), so both are optional, and left out when empty.
 * No price, amount, status or place of service is in either payload, so none
 * is here: pricing, statuses and the lifecycle are the backend's to define.
 *
 * Assumed until the contract says otherwise (no endpoint or response is
 * known): a saved visit comes back as its payload plus a numeric `id`, each of
 * its charge lines with its own `id` and `visit_id`; a charge line likewise.
 *
 * Ids: the examples' are numbers. Locations and providers have numeric ids
 * here. Cases, authorizations and procedure codes are still frontend-only in
 * this application, so they are referred to by the frontend's own identifier
 * (a case's id, a code's CPT / HCPCS code) until their backends assign ids.
 */
export type RecordRef = number | string

const recordRef = z.union([z.number().int(), z.string()])

export interface ChargeLineFields {
  procedure_code_id: RecordRef
  units: number
  /** E.g. `["GP", "59"]`, in the order billed. */
  modifiers?: string[]
  /** Positions in the case's diagnosis list (1 = the first), in order: `[2, 1]`. */
  diagnosis_pointers?: number[]
}

export interface CreateVisitPayload {
  case_id: RecordRef
  /** ISO date. */
  date_of_service: string
  location_id: number
  billing_provider_id: number
  treating_provider_id: number
  authorization_id: RecordRef | null
  charge_lines: ChargeLineFields[]
}

export interface CreateChargeLinePayload extends ChargeLineFields {
  visit_id: number
}

const chargeLineWire = z.object({
  id: z.number().int(),
  visit_id: z.number().int(),
  procedure_code_id: recordRef,
  units: z.number().int(),
  modifiers: z.array(z.string()).optional(),
  diagnosis_pointers: z.array(z.number().int()).optional(),
})

const toChargeLine = (wire: z.infer<typeof chargeLineWire>) => ({
  id: wire.id,
  visitId: wire.visit_id,
  procedureCode: wire.procedure_code_id,
  units: wire.units,
  modifiers: wire.modifiers ?? [],
  diagnosisPointers: wire.diagnosis_pointers ?? [],
})

export const chargeLineResponseSchema = chargeLineWire.transform(toChargeLine)
export type ChargeLine = z.output<typeof chargeLineResponseSchema>

export const visitResponseSchema = z
  .object({
    id: z.number().int(),
    case_id: recordRef,
    date_of_service: z.string(),
    location_id: z.number().int(),
    billing_provider_id: z.number().int(),
    treating_provider_id: z.number().int(),
    authorization_id: recordRef.nullable(),
    charge_lines: z.array(chargeLineWire),
  })
  .transform((wire) => ({
    id: wire.id,
    caseId: wire.case_id,
    dateOfService: wire.date_of_service,
    locationId: wire.location_id,
    billingProviderId: wire.billing_provider_id,
    treatingProviderId: wire.treating_provider_id,
    authorizationId: wire.authorization_id,
    chargeLines: wire.charge_lines.map(toChargeLine),
  }))

export type Visit = z.output<typeof visitResponseSchema>

/** A line's fields as the payloads carry them: empty lists are left out, as in the examples. */
export function chargeLineFields(line: {
  procedureCode: RecordRef
  units: number
  modifiers: readonly string[]
  diagnosisPointers: readonly number[]
}): ChargeLineFields {
  return {
    procedure_code_id: line.procedureCode,
    units: line.units,
    ...(line.modifiers.length === 0 ? {} : { modifiers: [...line.modifiers] }),
    ...(line.diagnosisPointers.length === 0 ? {} : { diagnosis_pointers: [...line.diagnosisPointers] }),
  }
}

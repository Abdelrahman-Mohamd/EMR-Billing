import { z } from 'zod'
import type { ChargeLineFields } from '@/features/visits'

/**
 * A claim, as the backend's payload example defines it (2026-10-02):
 * `{ visit_id, procedure_code_id, units, modifiers, diagnosis_pointers }` —
 * a visit and one procedure line, the same fields as a charge line. So a claim
 * is made here from one of the visit's charge lines, its values copied as they
 * are. Whether the backend links the claim to the line itself, allows more
 * than one line or more than one claim per line, and what lifecycle a claim has
 * are not known: no claim number, status, amount or payer is in the payload, so
 * none is shown.
 *
 * Assumed until the contract says otherwise: a saved claim comes back as its
 * payload plus a numeric `id`.
 */
export interface CreateClaimPayload extends ChargeLineFields {
  visit_id: number
}

export const claimResponseSchema = z
  .object({
    id: z.number().int(),
    visit_id: z.number().int(),
    procedure_code_id: z.union([z.number().int(), z.string()]),
    units: z.number().int(),
    modifiers: z.array(z.string()).optional(),
    diagnosis_pointers: z.array(z.number().int()).optional(),
  })
  .transform((wire) => ({
    id: wire.id,
    visitId: wire.visit_id,
    procedureCode: wire.procedure_code_id,
    units: wire.units,
    modifiers: wire.modifiers ?? [],
    diagnosisPointers: wire.diagnosis_pointers ?? [],
  }))

export type Claim = z.output<typeof claimResponseSchema>

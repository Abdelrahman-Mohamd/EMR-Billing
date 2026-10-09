import type { ChargeLineFields } from './visit'

/**
 * A charge line on its own, as the backend takes it (contract given
 * 2026-10-09, tried on staging with a made-up patient):
 *
 * - `POST /charge-lines` `{ visit_id, procedure_code_id, units, modifiers?,
 *   diagnosis_pointers?, place_of_service?, notes? }`; `PUT
 *   /charge-lines/{id}` — the same without the visit (refused); `DELETE`.
 *   Writes answer `{ success, message, data: null }`.
 * - `GET /charge-lines?page=N` and `GET /charge-lines/{id}` → `{ id,
 *   visit_id, procedure_code_id, procedure_code: { id, code, description },
 *   units, amount, modifiers, diagnosis_pointers, place_of_service, notes }` —
 *   the same lines a visit read on its own carries, so the visit page reads
 *   them there and these two are not used.
 *
 * Seen on staging: the line's rules are a visit's line's (schemas/visit.ts):
 * an active procedure code, 1 to 99 units, up to four modifiers of two letters
 * or digits, up to four distinct pointers within the visit's diagnoses (out of
 * range: a message with no field), a two-digit place of service (left out: the
 * location's), notes of at most 1000 characters. `diagnosis_pointers` may not
 * be null. The server prices the line again and the visit's total follows.
 * A save may change the procedure code. A visit may lose its last line (its
 * release then pends: "Add at least one charge line."). Once the visit is
 * released its lines are frozen: "This visit has been released; its charge
 * lines can no longer change."
 */
export interface ChargeLineUpdatePayload extends ChargeLineFields {
  /** Two digits; left out, the line keeps its own (a new line: the location's). */
  place_of_service?: string
  notes?: string | null
}

export interface ChargeLinePayload extends ChargeLineUpdatePayload {
  visit_id: number
}

/**
 * Backend field → form field, so a server's field error lands on the right
 * input: `modifiers.0` → `modifiers`, `diagnosis_pointers.1` →
 * `diagnosisPointers`.
 */
export function chargeLineFormFieldFor(path: string): string {
  const field = path.split('.')[0] ?? path
  return (
    {
      procedure_code_id: 'procedureCode',
      units: 'units',
      modifiers: 'modifiers',
      diagnosis_pointers: 'diagnosisPointers',
      place_of_service: 'placeOfService',
      notes: 'notes',
    }[field] ?? field
  )
}

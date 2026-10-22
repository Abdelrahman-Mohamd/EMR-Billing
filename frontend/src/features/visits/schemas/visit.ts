import { z } from 'zod'

/**
 * A visit and its charge lines, as the backend sends and takes them (contract
 * given 2026-10-09, tried on staging with a made-up patient):
 *
 * - `GET /visits?page=N` → Laravel pagination of `{ id, case_id,
 *   date_of_service, status, pend_reason, source, emr_record_id,
 *   diagnosis_codes, location_id, billing_provider_id, treating_provider_id,
 *   authorization_id, total_amount, released_at, patient: { id, first_name,
 *   last_name, date_of_birth }, case: { id, name, insurances }, location: { id,
 *   name, place_of_service }, treating_provider: { id, name, npi },
 *   charge_lines: [{ id, visit_id, procedure_code_id, units, amount, modifiers,
 *   diagnosis_pointers, place_of_service, notes }] }`;
 * - `GET /visits/{id}` → the same, with `billing_provider`, `authorization`,
 *   each line's `procedure_code: { id, code, description }` and `claims`;
 * - `POST /visits` `{ case_id, date_of_service, location_id,
 *   billing_provider_id, treating_provider_id, authorization_id, charge_lines:
 *   [{ procedure_code_id, units, modifiers?, diagnosis_pointers? }] }`;
 *   `PUT /visits/{id}` — the visit's own fields only (the case and the charge
 *   lines are refused — a line changes on its own, schemas/charge-line.ts);
 *   `DELETE`; `POST /visits/{id}/release`. Writes answer
 *   `{ success, message, data: null }`; the release answers with the visit.
 *
 * Seen on staging: a visit starts in `review`. Releasing it sends it to be
 * claimed (`released`, with `released_at`; its authorization is used then) or
 * pends it (`pended`, with the reason, which is also the release's message —
 * e.g. the insurance requires an authorization and none in force has enough
 * left). A released visit can no longer change: edit, release and delete are
 * refused ("This visit has already been released and can no longer change.").
 * Required: the case, the date of service (not after today; one visit per case
 * a day — "This case already has a visit on that date."), the location (an
 * active one of the patient's practice), both providers (active, of the
 * practice) and at least one charge line: an active procedure code, 1 to 99
 * units, up to four modifiers of two letters or digits (the server capitals
 * them), up to four distinct diagnosis pointers within the visit's diagnoses
 * (out of range: a message with no field). A line without pointers points at
 * the first diagnosis. The authorization must be one of the case's
 * insurances'. The amount is the server's (the fee schedule's price × units);
 * the place of service is the location's.
 *
 * The visit's own diagnoses (`diagnosis_codes`, taken on `POST` and `PUT`
 * since 2026-10-20): up to 12 ICD-10-CM codes, none twice ("Each diagnosis
 * must be a valid ICD-10-CM code, e.g. M54.2." on `diagnosis_codes.N`), in
 * order — a line's pointers name their positions. Left out of a `POST`, the
 * visit copies its case's; this app sends them, starting from the case's.
 *
 * A line also carries, since 2026-10-20, what scrubbing did to it: when the
 * visit is released, an active coding rule may replace its code
 * (`coding_rule_id`, and the code it had, `original_procedure_code_id`; the
 * amount is re-priced) or drop the line. The rule and the original code come
 * as ids only.
 *
 * A line may also carry, on create (user, 2026-10-09: the server takes them,
 * so use them): its own `place_of_service` — two digits, `00`–`99`; left out,
 * the location's — and `notes`, at most 1000 characters (trimmed; empty is
 * none). Neither is sent empty: the server refuses an empty place of service.
 *
 * Not used here: `emr_record_id`, `case.insurances`, the patient's birth
 * date, `claims` (Claims lists its own).
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

const named = z
  .object({ name: text, npi: text })
  .nullable()
  .optional()
  .transform((value) => value ?? null)

export type VisitStatus = 'review' | 'pended' | 'released'

export interface ChargeLineFields {
  procedure_code_id: number
  units: number
  /** E.g. `["GP", "59"]`, in the order billed. */
  modifiers?: string[]
  /** Positions in the visit's diagnosis list (1 = the first), in order: `[2, 1]`. */
  diagnosis_pointers?: number[]
}

/** A line as a new visit carries it: the line's fields, and its own place of service and notes. */
export interface VisitLinePayload extends ChargeLineFields {
  /** Two digits; left out, the location's. */
  place_of_service?: string
  notes?: string
}

/** Recording a visit (`POST`), its charge lines with it. */
export interface CreateVisitPayload {
  case_id: number
  /** ISO date. */
  date_of_service: string
  location_id: number
  billing_provider_id: number
  treating_provider_id: number
  authorization_id: number | null
  /** ICD-10-CM codes, in pointer order. */
  diagnosis_codes: string[]
  charge_lines: VisitLinePayload[]
}

/** Saving a visit (`PUT`): its own fields — not its case, not its lines. */
export type UpdateVisitPayload = Omit<CreateVisitPayload, 'case_id' | 'charge_lines'>

const chargeLineWire = z.object({
  id: z.number().int(),
  visit_id: z.number().int(),
  procedure_code_id: z.number().int(),
  procedure_code: z.object({ code: text, description: text }).nullable().optional(),
  units: z.number().int(),
  amount: text,
  modifiers: z.array(z.string()).nullable().optional(),
  diagnosis_pointers: z.array(z.number().int()).nullable().optional(),
  place_of_service: text,
  notes: text,
  coding_rule_id: z.number().int().nullable().optional(),
  original_procedure_code_id: z.number().int().nullable().optional(),
})

const toChargeLine = (wire: z.infer<typeof chargeLineWire>) => ({
  id: wire.id,
  visitId: wire.visit_id,
  procedureCodeId: wire.procedure_code_id,
  /** The code and its description — on a visit read on its own; else ''. */
  procedureCode: wire.procedure_code?.code ?? '',
  procedureDescription: wire.procedure_code?.description ?? '',
  units: wire.units,
  /** "60.00", as the server prices it. */
  amount: wire.amount,
  modifiers: wire.modifiers ?? [],
  diagnosisPointers: wire.diagnosis_pointers ?? [],
  placeOfService: wire.place_of_service,
  notes: wire.notes,
  /** The coding rule that replaced the line's code when the visit was released; else null. */
  codingRuleId: wire.coding_rule_id ?? null,
  /** The code it had before that rule; else null. */
  originalProcedureCodeId: wire.original_procedure_code_id ?? null,
})

export type ChargeLine = ReturnType<typeof toChargeLine>

export const visitResponseSchema = z
  .object({
    id: z.number().int(),
    case_id: z.number().int(),
    date_of_service: z.string(),
    status: z.string(),
    pend_reason: text,
    source: text,
    diagnosis_codes: z.array(z.string()).nullable().optional(),
    location_id: z.number().int(),
    billing_provider_id: z.number().int(),
    treating_provider_id: z.number().int(),
    authorization_id: z.number().int().nullable(),
    total_amount: text,
    released_at: text,
    patient: z.object({ id: z.number().int(), first_name: text, last_name: text }).nullable().optional(),
    case: z.object({ name: text }).nullable().optional(),
    location: z.object({ name: text, place_of_service: text }).nullable().optional(),
    billing_provider: named,
    treating_provider: named,
    authorization: z
      .object({ number: text, start_date: text, end_date: text })
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    charge_lines: z.array(chargeLineWire),
  })
  .transform((wire) => ({
    id: wire.id,
    caseId: String(wire.case_id),
    caseName: wire.case?.name ?? '',
    patientId: wire.patient === null || wire.patient === undefined ? '' : String(wire.patient.id),
    patientFirstName: wire.patient?.first_name ?? '',
    patientLastName: wire.patient?.last_name ?? '',
    dateOfService: wire.date_of_service,
    /** `review`, `pended` or `released` — or another the server adds. */
    status: wire.status,
    pendReason: wire.pend_reason,
    /** `manual`, or where it came from. */
    source: wire.source,
    /** The visit's own diagnoses, in order: what its pointers name. */
    diagnosisCodes: wire.diagnosis_codes ?? [],
    locationId: wire.location_id,
    locationName: wire.location?.name ?? '',
    placeOfService: wire.location?.place_of_service ?? '',
    billingProviderId: wire.billing_provider_id,
    /** On a visit read on its own; else null. */
    billingProvider: wire.billing_provider,
    treatingProviderId: wire.treating_provider_id,
    treatingProvider: wire.treating_provider,
    authorizationId: wire.authorization_id === null ? null : String(wire.authorization_id),
    /** On a visit read on its own; else null. */
    authorization: wire.authorization,
    /** "90.00". */
    totalAmount: wire.total_amount,
    /** A timestamp, or ''. */
    releasedAt: wire.released_at,
    chargeLines: wire.charge_lines.map(toChargeLine),
  }))

export type Visit = z.output<typeof visitResponseSchema>

export const visitPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(visitResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ visits: data.data, pageCount: data.meta.last_page }))

export const visitDetailResponseSchema = z.object({ data: visitResponseSchema }).transform(({ data }) => data)

/** The release's answer: the server's message, and the visit as it now stands. */
export const releaseResponseSchema = z
  .object({ message: z.string().nullable().optional(), data: visitResponseSchema })
  .transform(({ message, data }) => ({ message: message ?? null, visit: data }))

export type ReleaseResult = z.output<typeof releaseResponseSchema>

const FIELDS: Readonly<Record<string, string>> = {
  case_id: 'caseId',
  date_of_service: 'dateOfService',
  location_id: 'locationId',
  billing_provider_id: 'billingProviderId',
  treating_provider_id: 'treatingProviderId',
  authorization_id: 'authorizationId',
  charge_lines: 'lines',
}

/**
 * Backend field → form field, so a server's field error lands on the right
 * input: `charge_lines.1.units` → `lines.1.units`, a modifier or pointer's
 * error on its line's field, a diagnosis code's on the diagnoses.
 */
export function visitFormFieldFor(path: string): string {
  const line = /^charge_lines\.(\d+)\.([a-z_]+)/.exec(path)
  if (line !== null) {
    const field =
      {
        procedure_code_id: 'procedureCode',
        units: 'units',
        modifiers: 'modifiers',
        diagnosis_pointers: 'diagnosisPointers',
        place_of_service: 'placeOfService',
        notes: 'notes',
      }[line[2] ?? ''] ?? 'procedureCode'
    return `lines.${line[1] ?? '0'}.${field}`
  }
  // One code's refusal (`diagnosis_codes.2`) lands on the diagnoses.
  if (/^diagnosis_codes(\.\d+)?$/.test(path)) return 'diagnosisCodes'
  return FIELDS[path] ?? path
}

/** A line's fields as the payload carries them: empty lists are left out, as in the contract's example. */
export function chargeLineFields(line: {
  procedureCodeId: number
  units: number
  modifiers: readonly string[]
  diagnosisPointers: readonly number[]
}): ChargeLineFields {
  return {
    procedure_code_id: line.procedureCodeId,
    units: line.units,
    ...(line.modifiers.length === 0 ? {} : { modifiers: [...line.modifiers] }),
    ...(line.diagnosisPointers.length === 0 ? {} : { diagnosis_pointers: [...line.diagnosisPointers] }),
  }
}

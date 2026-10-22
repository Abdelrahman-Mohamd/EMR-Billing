import { z } from 'zod'
import type { ChargeLinePayload, ChargeLineUpdatePayload } from './charge-line'
import {
  chargeLineFields,
  type ChargeLine,
  type CreateVisitPayload,
  type UpdateVisitPayload,
  type Visit,
  type VisitLinePayload,
} from './visit'

/**
 * What the visit form accepts — the server's rules (schemas/visit.ts): the
 * case, the date of service (not after today), the location and both
 * providers, an optional authorization, and at least one charge line — a
 * procedure code, 1 to 99 units, up to four modifiers of two letters or digits,
 * up to four diagnosis pointers, an optional two-digit place of service and
 * notes of at most 1000 characters. What only the server knows (one visit per case
 * a day, which locations and providers are active, a pointer past the visit's
 * diagnoses) it says, on the field when it names one.
 */
export const MODIFIER_SLOTS = 4
export const POINTER_SLOTS = 4
export const UNITS_MAX = 99
export const NOTES_MAX = 1000

/** "gp, 59" → ["GP", "59"]. */
export function splitModifiers(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((modifier) => modifier.trim().toUpperCase())
    .filter(Boolean)
}

export const chargeLineFormSchema = z.object({
  /** The procedure code's id, as text. */
  procedureCode: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a procedure code.'),
  units: z
    .string()
    .trim()
    .min(1, 'Enter the units.')
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= UNITS_MAX),
      `Enter a whole number from 1 to ${UNITS_MAX}.`,
    ),
  /** "GP, 59": separated by commas or spaces, in the order billed. */
  modifiers: z
    .string()
    .refine((value) => splitModifiers(value).length <= MODIFIER_SLOTS, 'Enter up to four modifiers.')
    .refine(
      (value) => splitModifiers(value).every((modifier) => /^[A-Z0-9]{2}$/.test(modifier)),
      'Each modifier is two letters or digits, e.g. GP or 59.',
    ),
  /** Positions in the visit's diagnoses ("1", "2"), in the order chosen. */
  diagnosisPointers: z
    .array(z.string())
    .refine((value) => value.length <= POINTER_SLOTS, 'Choose up to four diagnoses.'),
  /** Two digits, or empty: the location's. */
  placeOfService: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{2}$/.test(value), 'Enter two digits, e.g. 11.'),
  notes: z.string().trim().max(NOTES_MAX, `Use at most ${NOTES_MAX} characters.`),
})
export type ChargeLineFormValues = z.infer<typeof chargeLineFormSchema>

export const newChargeLineValues = (): ChargeLineFormValues => ({
  procedureCode: null,
  units: '1',
  modifiers: '',
  diagnosisPointers: [],
  placeOfService: '',
  notes: '',
})

export const DIAGNOSES_MAX = 12

/** The visit's own fields: what a save (`PUT`) may change. */
const visitFields = z.object({
  dateOfService: z.string(),
  locationId: z.string().nullable(),
  billingProviderId: z.string().nullable(),
  treatingProviderId: z.string().nullable(),
  authorizationId: z.string().nullable(),
  /** ICD-10-CM codes, in the order chosen: the position is the pointer. */
  diagnosisCodes: z
    .array(z.string())
    .refine((value) => value.length <= DIAGNOSES_MAX, `Choose up to ${DIAGNOSES_MAX} diagnoses.`),
})

function checkVisitFields(
  v: {
    dateOfService: string
    locationId: string | null
    billingProviderId: string | null
    treatingProviderId: string | null
  },
  today: string,
  issue: (path: string, message: string) => void,
) {
  if (v.dateOfService === '') issue('dateOfService', 'Enter the date of service.')
  else if (v.dateOfService > today) issue('dateOfService', 'Enter a date of service on or before today.')
  if (v.locationId === null) issue('locationId', 'Select a location.')
  if (v.billingProviderId === null) issue('billingProviderId', 'Select the billing provider.')
  if (v.treatingProviderId === null) issue('treatingProviderId', 'Select the treating provider.')
}

export const visitFormSchema = (today: string) =>
  visitFields
    .extend({ caseId: z.string().nullable(), lines: z.array(chargeLineFormSchema) })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.caseId === null) issue('caseId', 'Select a case.')
      checkVisitFields(v, today, issue)
    })
export type VisitFormValues = z.infer<ReturnType<typeof visitFormSchema>>

export const editVisitFormSchema = (today: string) =>
  visitFields.superRefine((v, ctx) =>
    checkVisitFields(v, today, (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })),
  )
export type EditVisitFormValues = z.infer<ReturnType<typeof editVisitFormSchema>>

/** A new visit: its diagnoses start as its case's (`caseCodes`), in the case's order. */
export const newVisitValues = (
  caseId: string | null,
  today: string,
  caseCodes: readonly string[] = [],
): VisitFormValues => ({
  caseId,
  dateOfService: today,
  locationId: null,
  billingProviderId: null,
  treatingProviderId: null,
  authorizationId: null,
  diagnosisCodes: [...caseCodes],
  lines: [newChargeLineValues()],
})

export const toEditVisitValues = (visit: Visit): EditVisitFormValues => ({
  dateOfService: visit.dateOfService,
  locationId: String(visit.locationId),
  billingProviderId: String(visit.billingProviderId),
  treatingProviderId: String(visit.treatingProviderId),
  authorizationId: visit.authorizationId,
  diagnosisCodes: [...visit.diagnosisCodes],
})

function lineOf(values: ChargeLineFormValues): VisitLinePayload {
  // The schema has refused a missing code or bad units before this runs.
  return {
    ...chargeLineFields({
      procedureCodeId: Number(values.procedureCode),
      units: Number(values.units),
      modifiers: splitModifiers(values.modifiers),
      diagnosisPointers: values.diagnosisPointers.map(Number),
    }),
    // Left out when empty: the server refuses an empty place of service.
    ...(values.placeOfService === '' ? {} : { place_of_service: values.placeOfService }),
    ...(values.notes === '' ? {} : { notes: values.notes }),
  }
}

/** A save (`PUT`): the visit's own fields, every one. */
export function toUpdateVisitPayload(values: EditVisitFormValues): UpdateVisitPayload {
  // The schema has refused every missing required choice before this runs.
  return {
    date_of_service: values.dateOfService,
    location_id: Number(values.locationId),
    billing_provider_id: Number(values.billingProviderId),
    treating_provider_id: Number(values.treatingProviderId),
    authorization_id: values.authorizationId === null ? null : Number(values.authorizationId),
    diagnosis_codes: [...values.diagnosisCodes],
  }
}

/** Recording a visit (`POST`), by the server's ids, its charge lines with it. */
export function toCreateVisitPayload(values: VisitFormValues): CreateVisitPayload {
  return {
    case_id: Number(values.caseId),
    ...toUpdateVisitPayload(values),
    charge_lines: values.lines.map(lineOf),
  }
}

/** A line read with its visit, as the line form edits it. */
export const toChargeLineFormValues = (line: ChargeLine): ChargeLineFormValues => ({
  procedureCode: String(line.procedureCodeId),
  units: String(line.units),
  modifiers: line.modifiers.join(', '),
  diagnosisPointers: line.diagnosisPointers.map(String),
  placeOfService: line.placeOfService,
  notes: line.notes,
})

/** Adding a line to a visit (`POST /charge-lines`): as a new visit's line, with its visit. */
export function toChargeLinePayload(visitId: number, values: ChargeLineFormValues): ChargeLinePayload {
  return { visit_id: visitId, ...lineOf(values) }
}

/**
 * Saving a line (`PUT /charge-lines/{id}`): every field, the lists even when
 * empty and the notes as none, so clearing one clears it. An empty place of
 * service is left out (the server refuses it): the line keeps its own.
 */
export function toChargeLineUpdatePayload(values: ChargeLineFormValues): ChargeLineUpdatePayload {
  return {
    procedure_code_id: Number(values.procedureCode),
    units: Number(values.units),
    modifiers: splitModifiers(values.modifiers),
    diagnosis_pointers: values.diagnosisPointers.map(Number),
    ...(values.placeOfService === '' ? {} : { place_of_service: values.placeOfService }),
    notes: values.notes === '' ? null : values.notes,
  }
}

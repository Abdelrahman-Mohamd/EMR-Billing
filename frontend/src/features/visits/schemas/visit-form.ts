import { z } from 'zod'
import { chargeLineFields, type CreateChargeLinePayload, type CreateVisitPayload } from './visit'

/**
 * What the visit and charge-line forms accept. Required: what the payload
 * examples always carry — the case, date of service, location, both providers,
 * and on each line a procedure code and its units (a whole number, at least
 * one). Optional, as in the examples: the authorization, a line's modifiers and
 * its diagnosis pointers. The date of service may not be in the future (as the
 * prototype's manual entry checks). Nothing else is checked here: the server
 * decides what else a visit or a line must satisfy.
 */
/** As many as a procedure code's modifier slots. */
export const MODIFIER_SLOTS = 4

/** "gp, 59" → ["GP", "59"]. */
export function splitModifiers(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((modifier) => modifier.trim().toUpperCase())
    .filter(Boolean)
}

export const chargeLineFormSchema = z.object({
  procedureCode: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a procedure code.'),
  units: z
    .string()
    .trim()
    .min(1, 'Enter the units.')
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1),
      'Please enter a valid number of units.',
    ),
  /** "GP, 59": separated by commas or spaces, in the order billed. */
  modifiers: z
    .string()
    .refine((value) => splitModifiers(value).length <= MODIFIER_SLOTS, 'Enter up to four modifiers.'),
  /** Diagnosis positions on the case ("1", "2"), in the order chosen. */
  diagnosisPointers: z.array(z.string()),
})
export type ChargeLineFormValues = z.infer<typeof chargeLineFormSchema>

export const newChargeLineValues = (): ChargeLineFormValues => ({
  procedureCode: null,
  units: '1',
  modifiers: '',
  diagnosisPointers: [],
})

export const visitFormSchema = (today: string) =>
  z
    .object({
      caseId: z.string().nullable(),
      dateOfService: z.string(),
      locationId: z.string().nullable(),
      billingProviderId: z.string().nullable(),
      treatingProviderId: z.string().nullable(),
      authorizationId: z.string().nullable(),
      lines: z.array(chargeLineFormSchema),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.caseId === null) issue('caseId', 'Select a case.')
      if (v.dateOfService === '') issue('dateOfService', 'Enter the date of service.')
      else if (v.dateOfService > today) issue('dateOfService', 'Please enter a valid date.')
      if (v.locationId === null) issue('locationId', 'Select a location.')
      if (v.billingProviderId === null) issue('billingProviderId', 'Select the billing provider.')
      if (v.treatingProviderId === null) issue('treatingProviderId', 'Select the treating provider.')
    })
export type VisitFormValues = z.infer<ReturnType<typeof visitFormSchema>>

export const newVisitValues = (caseId: string | null, today: string): VisitFormValues => ({
  caseId,
  dateOfService: today,
  locationId: null,
  billingProviderId: null,
  treatingProviderId: null,
  authorizationId: null,
  lines: [newChargeLineValues()],
})

function lineOf(values: ChargeLineFormValues) {
  // The schema has refused a missing code or bad units before this runs.
  return chargeLineFields({
    procedureCode: values.procedureCode ?? '',
    units: Number(values.units),
    modifiers: splitModifiers(values.modifiers),
    diagnosisPointers: values.diagnosisPointers.map(Number),
  })
}

export function toCreateVisitPayload(values: VisitFormValues): CreateVisitPayload {
  // The schema has refused every missing required choice before this runs.
  return {
    case_id: values.caseId ?? '',
    date_of_service: values.dateOfService,
    location_id: Number(values.locationId),
    billing_provider_id: Number(values.billingProviderId),
    treating_provider_id: Number(values.treatingProviderId),
    authorization_id: values.authorizationId,
    charge_lines: values.lines.map(lineOf),
  }
}

export function toCreateChargeLinePayload(
  visitId: number,
  values: ChargeLineFormValues,
): CreateChargeLinePayload {
  return { visit_id: visitId, ...lineOf(values) }
}

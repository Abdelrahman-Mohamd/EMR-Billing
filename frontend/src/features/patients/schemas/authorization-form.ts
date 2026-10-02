import { z } from 'zod'
import type { AuthorizationValues } from '../data/patient-records-store'
import { AUTH_UNITS } from '../model/authorization'

/**
 * What the authorization form accepts — the prototype's checks: who issued
 * it, its number, start and end (the end not before the start), and how many
 * visits or units were approved (a whole number from 1 to 999).
 */
export const authorizationFormSchema = z
  .object({
    coverageId: z.string().nullable(),
    number: z.string().trim(),
    start: z.string(),
    end: z.string(),
    qty: z.string().trim(),
    unit: z.enum(AUTH_UNITS),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.coverageId === null) issue('coverageId', 'Select the insurance that issued it.')
    if (v.number === '') issue('number', 'Enter the authorization number.')
    if (v.start === '') issue('start', 'Enter the start date.')
    if (v.end === '') issue('end', 'Enter the end date.')
    else if (v.start !== '' && v.end < v.start) issue('end', 'Please enter a valid date.')
    if (v.qty === '') issue('qty', 'Enter how many were approved.')
    else if (!/^\d+$/.test(v.qty) || Number(v.qty) < 1 || Number(v.qty) > 999)
      issue('qty', 'Please enter a valid number.')
  })

export type AuthorizationFormValues = z.infer<typeof authorizationFormSchema>

export function newAuthorizationValues(coverageId: string | null): AuthorizationFormValues {
  return { coverageId, number: '', start: '', end: '', qty: '', unit: 'Visits' }
}

export function toAuthorizationValues(values: AuthorizationFormValues): AuthorizationValues {
  return {
    coverageId: values.coverageId ?? '',
    number: values.number,
    start: values.start,
    end: values.end,
    qty: Number(values.qty),
    unit: values.unit,
  }
}

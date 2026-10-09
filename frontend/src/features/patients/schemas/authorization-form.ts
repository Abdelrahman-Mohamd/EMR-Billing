import { z } from 'zod'
import type { Authorization, AuthUnit } from '../model/authorization'
import type { AuthorizationPayload, AuthorizationUpdatePayload } from './authorization'

/** The server's limits (schemas/authorization.ts). */
export const AUTH_NUMBER_MAX = 50
export const AUTH_QTY_MAX = 9999

/**
 * What the authorization form accepts — the server's rules: the insurance
 * that issued it, its number (at most 50 characters), the start and end dates
 * (the end on or after the start), and how many visits or units were approved
 * (a whole number from 1 to 9999). The number's uniqueness on the insurance is
 * the server's to say.
 */
export const authorizationFormSchema = z
  .object({
    coverageId: z.string().nullable(),
    number: z.string().trim(),
    start: z.string(),
    end: z.string(),
    qty: z.string().trim(),
    unit: z.enum(['visits', 'units']),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.coverageId === null) issue('coverageId', 'Select the insurance that issued it.')
    if (v.number === '') issue('number', 'Enter the authorization number.')
    else if (v.number.length > AUTH_NUMBER_MAX) issue('number', `Use at most ${AUTH_NUMBER_MAX} characters.`)
    if (v.start === '') issue('start', 'Enter the start date.')
    if (v.end === '') issue('end', 'Enter the end date.')
    else if (v.start !== '' && v.end < v.start) issue('end', 'Enter an end date on or after the start date.')
    if (v.qty === '') issue('qty', 'Enter how many were approved.')
    else if (!/^\d+$/.test(v.qty) || Number(v.qty) < 1 || Number(v.qty) > AUTH_QTY_MAX)
      issue('qty', `Enter a whole number from 1 to ${AUTH_QTY_MAX}.`)
  })

export type AuthorizationFormValues = z.infer<typeof authorizationFormSchema>

export function newAuthorizationValues(coverageId: string | null): AuthorizationFormValues {
  return { coverageId, number: '', start: '', end: '', qty: '', unit: 'visits' satisfies AuthUnit }
}

export function toAuthorizationFormValues(auth: Authorization): AuthorizationFormValues {
  return {
    coverageId: auth.coverageId,
    number: auth.number,
    start: auth.start,
    end: auth.end,
    qty: String(auth.qty),
    unit: auth.unit,
  }
}

/** Saving (`PUT`): the insurance that issued it stays — the server refuses a change. */
export function toAuthorizationUpdatePayload(values: AuthorizationFormValues): AuthorizationUpdatePayload {
  return {
    number: values.number,
    start_date: values.start,
    end_date: values.end,
    authorized_qty: Number(values.qty),
    unit: values.unit,
  }
}

/** Adding (`POST`): with the case insurance that issued it, by the server's id. */
export function toAuthorizationPayload(values: AuthorizationFormValues): AuthorizationPayload {
  return { case_insurance_id: Number(values.coverageId), ...toAuthorizationUpdatePayload(values) }
}

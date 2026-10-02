import { z } from 'zod'
import { PHONE_PATTERN, STATE_PATTERN, ZIP_PATTERN } from '@/features/patients'
import { isValidNpi } from '@/lib/validation/npi'
import { LIMITS, isDummyPhone, zipState } from '../model/checks'

/**
 * What each Resolve form accepts: the prototype's checks on the fix, in the
 * Patients forms' words. Every form edits its source record; none edits the
 * exception itself.
 */
type Issue = (path: string, message: string) => void
const issuer =
  (ctx: z.RefinementCtx): Issue =>
  (path, message) =>
    ctx.addIssue({ code: 'custom', path: [path], message })

const AMOUNT = /^\d+(\.\d{1,2})?$/

// ---------------------------------------------------------------- patient: phone
export const phoneFixSchema = z
  .object({ phoneCell: z.string().trim(), phoneHome: z.string().trim() })
  .superRefine((v, ctx) => {
    const issue = issuer(ctx)
    // As the prototype: a cell phone unless there is a home phone; neither a placeholder.
    if (v.phoneCell === '' && v.phoneHome === '') issue('phoneCell', 'Enter a phone number.')
    for (const key of ['phoneCell', 'phoneHome'] as const) {
      const value = v[key]
      if (value !== '' && (!PHONE_PATTERN.test(value) || isDummyPhone(value)))
        issue(key, 'Please enter a valid phone number.')
    }
  })
export type PhoneFixValues = z.infer<typeof phoneFixSchema>

// ---------------------------------------------------------------- patient: address
export const addressFixSchema = z
  .object({
    line1: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim().toUpperCase(),
    zip: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const issue = issuer(ctx)
    if (v.line1 === '') issue('line1', 'Enter the street address.')
    if (v.city === '') issue('city', 'Enter the city.')
    if (v.state === '') issue('state', 'Enter the state.')
    else if (!STATE_PATTERN.test(v.state)) issue('state', 'Please enter a valid state.')
    if (v.zip === '') issue('zip', 'Enter the ZIP code.')
    // The prototype cross-checks the ZIP code against the state.
    else if (!ZIP_PATTERN.test(v.zip) || (zipState(v.zip) !== null && zipState(v.zip) !== v.state))
      issue('zip', 'Please enter a valid ZIP code.')
  })
export type AddressFixValues = z.infer<typeof addressFixSchema>

// ---------------------------------------------------------------- patient: field length
export const lengthFixSchema = z
  .object({
    firstName: z.string().trim(),
    lastName: z.string().trim(),
    middleName: z.string().trim(),
    line1: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const issue = issuer(ctx)
    if (v.firstName === '') issue('firstName', 'Enter the first name.')
    if (v.lastName === '') issue('lastName', 'Enter the last name.')
    if (v.line1 === '') issue('line1', 'Enter the street address.')
    else if (v.line1.length > LIMITS.addressLine) issue('line1', 'Please shorten the address.')
  })
export type LengthFixValues = z.infer<typeof lengthFixSchema>

// ---------------------------------------------------------------- case fields
export const caseFixSchema = (missing: 'injuryDate' | 'employmentStatus' | 'referrer') =>
  z
    .object({
      injuryDate: z.string(),
      employmentStatus: z.string().trim(),
      referrerId: z.string().nullable(),
    })
    .superRefine((v, ctx) => {
      const issue = issuer(ctx)
      // The prototype requires the field the exception names.
      if (missing === 'injuryDate' && v.injuryDate === '')
        issue('injuryDate', 'Enter the injury or onset date.')
      if (missing === 'employmentStatus' && v.employmentStatus === '')
        issue('employmentStatus', 'Enter the employment status.')
      if (missing === 'referrer' && v.referrerId === null)
        issue('referrerId', 'Select the referring physician.')
    })
export type CaseFixValues = z.infer<ReturnType<typeof caseFixSchema>>

// ---------------------------------------------------------------- coverage subscriber
export const subscriberFixSchema = z
  .object({ name: z.string().trim(), dob: z.string() })
  .superRefine((v, ctx) => {
    const issue = issuer(ctx)
    if (v.name === '') issue('name', 'Enter the subscriber’s name.')
    if (v.dob === '') issue('dob', 'Enter the subscriber’s date of birth.')
  })
export type SubscriberFixValues = z.infer<typeof subscriberFixSchema>

// ---------------------------------------------------------------- referring physician
export const referrerFixSchema = z
  .object({
    mode: z.enum(['npi', 'swap']).nullable(),
    npi: z.string().trim(),
    referrerId: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    const issue = issuer(ctx)
    if (v.mode === null) issue('mode', 'Choose how to fix it.')
    if (v.mode === 'npi') {
      if (v.npi === '') issue('npi', 'Enter the NPI.')
      else if (!isValidNpi(v.npi)) issue('npi', 'Please enter a valid NPI.')
    }
    if (v.mode === 'swap' && v.referrerId === null) issue('referrerId', 'Select the referring physician.')
  })
export type ReferrerFixValues = z.infer<typeof referrerFixSchema>

// ---------------------------------------------------------------- rendering NPI
export const npiFixSchema = z.object({
  npi: z
    .string()
    .trim()
    .min(1, 'Enter the NPI.')
    .refine((value) => isValidNpi(value), 'Please enter a valid NPI.'),
})
export type NpiFixValues = z.infer<typeof npiFixSchema>

// ---------------------------------------------------------------- price a code
export const feeFixSchema = z
  .object({ defaultFee: z.string().trim(), billed: z.string().trim() })
  .superRefine((v, ctx) => {
    const issue = issuer(ctx)
    // As the prototype: a default fee unless a payer rate is given — or both.
    if (v.defaultFee === '' && v.billed === '') issue('defaultFee', 'Enter the default fee.')
    if (v.defaultFee !== '' && !AMOUNT.test(v.defaultFee)) issue('defaultFee', 'Please enter a valid amount.')
    if (v.billed !== '' && !AMOUNT.test(v.billed)) issue('billed', 'Please enter a valid amount.')
  })
export type FeeFixValues = z.infer<typeof feeFixSchema>

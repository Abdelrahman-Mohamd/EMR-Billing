import { z } from 'zod'
import { WORKERS_COMP, type Coverage } from '../model/coverage'
import type { CaseInsurancePayload, CaseInsuranceUpdatePayload, SubscriberPayload } from './case-insurance'
import { STATE_PATTERN, ZIP_PATTERN } from './patient-form'

/**
 * What the coverage form accepts — as the server does:
 * - **Insurance**, **rank**, **member ID**: required. The insurance is chosen
 *   when the coverage is added and fixed afterwards.
 * - **Claim number**: required for Workers' Comp (Box 11b).
 * - **Subscriber**: when the patient is not the subscriber, their first and
 *   last name are required; date of birth not in the future.
 * - **Employer**: optional; an address, once begun, needs all four parts.
 * - **Termination date**: not before the effective date.
 * - **Not checked:** an insurance already on the case — the server's to say.
 *
 * `insuranceType` gives an insurance's type, by id.
 */
export function coverageFormSchema(
  today: string,
  insuranceType: (insuranceId: string | null) => string | undefined,
) {
  return z
    .object({
      insuranceId: z.string().nullable(),
      rank: z.string().nullable(),
      memberId: z.string().trim(),
      groupNumber: z.string().trim(),
      claimNumber: z.string().trim(),
      subscriberRelationship: z.string(),
      subscriberFirstName: z.string().trim(),
      subscriberLastName: z.string().trim(),
      subscriberDob: z.string(),
      subscriberGender: z.string().nullable(),
      employerName: z.string().trim(),
      employerLine1: z.string().trim(),
      employerCity: z.string().trim(),
      employerState: z.string().trim().toUpperCase(),
      employerZip: z.string().trim(),
      effectiveDate: z.string(),
      terminationDate: z.string(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.insuranceId === null) issue('insuranceId', 'Select an insurance.')
      if (v.rank === null) issue('rank', 'Select the priority.')
      if (v.memberId === '') issue('memberId', 'Enter the member ID.')
      if (insuranceType(v.insuranceId) === WORKERS_COMP && v.claimNumber === '')
        issue('claimNumber', 'Enter the claim number.')
      if (v.subscriberRelationship !== 'Self') {
        if (v.subscriberFirstName === '') issue('subscriberFirstName', 'Enter the subscriber’s first name.')
        if (v.subscriberLastName === '') issue('subscriberLastName', 'Enter the subscriber’s last name.')
        if (v.subscriberDob !== '' && v.subscriberDob > today)
          issue('subscriberDob', 'Please enter a valid date.')
      }
      const address = [v.employerLine1, v.employerCity, v.employerState, v.employerZip]
      if (address.some((part) => part !== '')) {
        if (v.employerName === '') issue('employerName', 'Enter the employer’s name.')
        if (v.employerLine1 === '') issue('employerLine1', 'Enter the employer’s address.')
        if (v.employerCity === '') issue('employerCity', 'Enter the city.')
        if (v.employerState === '') issue('employerState', 'Enter the state.')
        else if (!STATE_PATTERN.test(v.employerState)) issue('employerState', 'Please enter a valid state.')
        if (v.employerZip === '') issue('employerZip', 'Enter the ZIP code.')
        else if (!ZIP_PATTERN.test(v.employerZip)) issue('employerZip', 'Please enter a valid ZIP code.')
      }
      if (v.effectiveDate !== '' && v.terminationDate !== '' && v.terminationDate < v.effectiveDate)
        issue('terminationDate', 'Please enter a valid date.')
    })
}

export type CoverageFormValues = z.infer<ReturnType<typeof coverageFormSchema>>

/** A new coverage: the patient is the subscriber, ranked after the case's others. */
export function newCoverageValues(rank: string | null): CoverageFormValues {
  return {
    insuranceId: null,
    rank,
    memberId: '',
    groupNumber: '',
    claimNumber: '',
    subscriberRelationship: 'Self',
    subscriberFirstName: '',
    subscriberLastName: '',
    subscriberDob: '',
    subscriberGender: null,
    employerName: '',
    employerLine1: '',
    employerCity: '',
    employerState: '',
    employerZip: '',
    effectiveDate: '',
    terminationDate: '',
  }
}

export function toCoverageFormValues(coverage: Coverage): CoverageFormValues {
  const { subscriber, employer } = coverage
  return {
    insuranceId: String(coverage.insuranceId),
    rank: String(coverage.rank),
    memberId: coverage.memberId,
    groupNumber: coverage.groupNumber,
    claimNumber: coverage.claimNumber,
    subscriberRelationship: subscriber?.relationship || 'Self',
    subscriberFirstName: subscriber?.firstName ?? '',
    subscriberLastName: subscriber?.lastName ?? '',
    subscriberDob: subscriber?.dob ?? '',
    subscriberGender: subscriber === null || subscriber.gender === '' ? null : subscriber.gender,
    employerName: employer?.name ?? '',
    employerLine1: employer?.address?.line1 ?? '',
    employerCity: employer?.address?.city ?? '',
    employerState: employer?.address?.state ?? '',
    employerZip: employer?.address?.zip ?? '',
    effectiveDate: coverage.effectiveDate,
    terminationDate: coverage.terminationDate,
  }
}

const orNull = (value: string) => (value === '' ? null : value)

/** Self keeps no subscriber, as in the prototype. */
export function toSubscriberPayload(values: CoverageFormValues): SubscriberPayload | null {
  if (values.subscriberRelationship === 'Self') return null
  return {
    first_name: values.subscriberFirstName,
    last_name: values.subscriberLastName,
    relationship: values.subscriberRelationship,
    date_of_birth: orNull(values.subscriberDob),
    gender: values.subscriberGender,
  }
}

/** A save: everything but the case and the insurance, which a coverage never changes. */
export function toCoverageUpdatePayload(values: CoverageFormValues): CaseInsuranceUpdatePayload {
  // The schema has refused a missing rank before this runs.
  return {
    rank: Number(values.rank),
    member_id: values.memberId,
    group_number: orNull(values.groupNumber),
    claim_number: orNull(values.claimNumber),
    subscriber: toSubscriberPayload(values),
    // An employer only with a name; its address only when given.
    employer:
      values.employerName === ''
        ? null
        : {
            name: values.employerName,
            address:
              values.employerLine1 === ''
                ? null
                : {
                    line1: values.employerLine1,
                    city: values.employerCity,
                    state: values.employerState,
                    zip: values.employerZip,
                  },
          },
    effective_date: orNull(values.effectiveDate),
    termination_date: orNull(values.terminationDate),
  }
}

/** A new coverage: for its case, with the insurance chosen. */
export function toCoveragePayload(caseId: string, values: CoverageFormValues): CaseInsurancePayload {
  // The schema has refused a missing insurance before this runs.
  return {
    case_id: Number(caseId),
    insurance_id: Number(values.insuranceId),
    ...toCoverageUpdatePayload(values),
  }
}

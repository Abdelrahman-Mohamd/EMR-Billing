import { z } from 'zod'
import type { CoverageValues } from '../data/patient-records-store'
import { CLAIM_NUMBER_TYPES, WORKERS_COMP, type Coverage } from '../model/coverage'

/**
 * What the coverage form accepts — the prototype's checks:
 * - **Insurance**, **member ID**, **group number**: required (NONE when the
 *   plan has none).
 * - **Claim number**: required for a PIP or Workers' Comp insurance (Box 11b).
 * - **Subscriber name and date of birth**: required when the patient is not
 *   the subscriber.
 * - **Employer name**: required for a Workers' Comp insurance.
 *
 * `insuranceType` gives an insurance's type, by id.
 */
export function coverageFormSchema(insuranceType: (insuranceId: string | null) => string | undefined) {
  return z
    .object({
      insuranceId: z.string().nullable(),
      memberId: z.string().trim(),
      groupNumber: z.string().trim(),
      claimNumber: z.string().trim(),
      subscriberRelationship: z.string(),
      subscriberName: z.string().trim(),
      subscriberDob: z.string(),
      employerName: z.string().trim(),
      employerAddress: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      const type = insuranceType(v.insuranceId)
      if (v.insuranceId === null) issue('insuranceId', 'Select an insurance.')
      if (v.memberId === '') issue('memberId', 'Enter the member ID.')
      if (v.groupNumber === '') issue('groupNumber', 'Enter the group number.')
      if (
        type !== undefined &&
        (CLAIM_NUMBER_TYPES as readonly string[]).includes(type) &&
        v.claimNumber === ''
      )
        issue('claimNumber', 'Enter the claim number.')
      if (v.subscriberRelationship !== 'Self') {
        if (v.subscriberName === '') issue('subscriberName', 'Enter the subscriber’s name.')
        if (v.subscriberDob === '') issue('subscriberDob', 'Enter the subscriber’s date of birth.')
      }
      if (type === WORKERS_COMP && v.employerName === '') issue('employerName', 'Enter the employer’s name.')
    })
}

export type CoverageFormValues = z.infer<ReturnType<typeof coverageFormSchema>>

/** The prototype's start: the patient is the subscriber. */
export function newCoverageValues(): CoverageFormValues {
  return {
    insuranceId: null,
    memberId: '',
    groupNumber: '',
    claimNumber: '',
    subscriberRelationship: 'Self',
    subscriberName: '',
    subscriberDob: '',
    employerName: '',
    employerAddress: '',
  }
}

export function toCoverageFormValues(coverage: Coverage): CoverageFormValues {
  return {
    insuranceId: String(coverage.insuranceId),
    memberId: coverage.memberId,
    groupNumber: coverage.groupNumber,
    claimNumber: coverage.claimNumber,
    subscriberRelationship: coverage.subscriber?.relationship ?? 'Self',
    subscriberName: coverage.subscriber?.name ?? '',
    subscriberDob: coverage.subscriber?.dob ?? '',
    employerName: coverage.employer?.name ?? '',
    employerAddress: coverage.employer?.address ?? '',
  }
}

/** As the prototype saves it: Self keeps no subscriber, and an employer only with a name. */
export function toCoverageValues(values: CoverageFormValues): CoverageValues {
  return {
    insuranceId: Number(values.insuranceId),
    memberId: values.memberId,
    groupNumber: values.groupNumber,
    claimNumber: values.claimNumber,
    subscriber:
      values.subscriberRelationship === 'Self'
        ? null
        : {
            name: values.subscriberName,
            dob: values.subscriberDob,
            relationship: values.subscriberRelationship,
          },
    employer:
      values.employerName === '' ? null : { name: values.employerName, address: values.employerAddress },
  }
}

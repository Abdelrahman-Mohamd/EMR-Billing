import { z } from 'zod'
import type { Coverage } from '../model/coverage'

/**
 * A case's insurance, as the backend sends and takes it (contract given
 * 2026-10-08, tried on staging with a made-up patient):
 *
 * - `GET /case-insurances?page=N` → Laravel pagination of `{ id, case_id,
 *   insurance_id, rank, rank_label, member_id, group_number, claim_number,
 *   subscriber, patient_is_subscriber, employer, effective_date,
 *   termination_date, insurance: { id, code, name, display_name,
 *   insurance_type }, authorizations, created_at, updated_at }`;
 *   `GET /case-insurances/{id}` → the same;
 * - `POST /case-insurances` `{ case_id, insurance_id, rank, member_id,
 *   group_number, claim_number, subscriber: { first_name, last_name,
 *   relationship, date_of_birth, gender }, employer: { name, address: { line1,
 *   city, state, zip } }, effective_date, termination_date }`;
 *   `PUT /case-insurances/{id}` — without the case and the insurance (both
 *   refused); `DELETE`. Writes answer `{ success, message, data: null }`.
 *
 * Seen on staging: required are the case, the insurance (an active one of the
 * patient's practice), the rank (1 Primary, 2 Secondary, 3 Tertiary) and the
 * member ID. An insurance is on a case once ("already on the case"). Workers'
 * Comp needs a claim number (refused with a message, no field). A subscriber
 * is optional — `null` means the patient is the insured — and once given needs
 * a first and last name; its relationship is Spouse, Child or Other, its date
 * of birth not after today. An employer is optional; given, it needs a name,
 * and its address all four parts. The termination date is not before the
 * effective date. A `PUT` changes only the fields it carries; `null` clears
 * the subscriber or the employer.
 *
 * Not used here yet: `authorizations` (each coverage's, empty so far).
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

const subscriberSchema = z.object({
  first_name: text,
  last_name: text,
  relationship: text,
  date_of_birth: text,
  gender: text,
})

const employerSchema = z.object({
  name: text,
  address: z
    .object({ line1: text, city: text, state: text, zip: text })
    .nullable()
    .optional()
    .transform((value) => value ?? null),
})

export const caseInsuranceResponseSchema = z
  .object({
    id: z.number().int(),
    case_id: z.number().int(),
    insurance_id: z.number().int(),
    rank: z.number().int(),
    rank_label: text,
    member_id: text,
    group_number: text,
    claim_number: text,
    subscriber: subscriberSchema.nullable().optional(),
    employer: employerSchema.nullable().optional(),
    effective_date: text,
    termination_date: text,
    insurance: z.object({ name: text, display_name: text, insurance_type: text }).nullable().optional(),
  })
  .transform((wire): Coverage => ({
    id: String(wire.id),
    caseId: String(wire.case_id),
    insuranceId: wire.insurance_id,
    insuranceLabel: wire.insurance?.display_name ?? '',
    insuranceName: wire.insurance?.name ?? '',
    insuranceType: wire.insurance?.insurance_type ?? '',
    rank: wire.rank,
    rankLabel: wire.rank_label,
    memberId: wire.member_id,
    groupNumber: wire.group_number,
    claimNumber: wire.claim_number,
    subscriber:
      wire.subscriber === null || wire.subscriber === undefined
        ? null
        : {
            firstName: wire.subscriber.first_name,
            lastName: wire.subscriber.last_name,
            relationship: wire.subscriber.relationship,
            dob: wire.subscriber.date_of_birth,
            gender: wire.subscriber.gender,
          },
    employer:
      wire.employer === null || wire.employer === undefined
        ? null
        : { name: wire.employer.name, address: wire.employer.address },
    effectiveDate: wire.effective_date,
    terminationDate: wire.termination_date,
  }))

export const caseInsurancePageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(caseInsuranceResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ coverages: data.data, pageCount: data.meta.last_page }))

export interface SubscriberPayload {
  first_name: string
  last_name: string
  relationship: string
  date_of_birth: string | null
  gender: string | null
}

export interface EmployerPayload {
  name: string
  address: { line1: string; city: string; state: string; zip: string } | null
}

/** Saving a coverage (`PUT`): everything but the case and the insurance. */
export interface CaseInsuranceUpdatePayload {
  rank: number
  member_id: string
  group_number: string | null
  claim_number: string | null
  subscriber: SubscriberPayload | null
  employer: EmployerPayload | null
  effective_date: string | null
  termination_date: string | null
}

/** Adding a coverage (`POST`): with its case and insurance. */
export interface CaseInsurancePayload extends CaseInsuranceUpdatePayload {
  case_id: number
  insurance_id: number
}

const FIELDS: Readonly<Record<string, string>> = {
  insurance_id: 'insuranceId',
  member_id: 'memberId',
  group_number: 'groupNumber',
  claim_number: 'claimNumber',
  effective_date: 'effectiveDate',
  termination_date: 'terminationDate',
  subscriber: 'subscriberFirstName',
  'subscriber.first_name': 'subscriberFirstName',
  'subscriber.last_name': 'subscriberLastName',
  'subscriber.relationship': 'subscriberRelationship',
  'subscriber.date_of_birth': 'subscriberDob',
  'subscriber.gender': 'subscriberGender',
  employer: 'employerName',
  'employer.name': 'employerName',
  'employer.address': 'employerLine1',
  'employer.address.line1': 'employerLine1',
  'employer.address.city': 'employerCity',
  'employer.address.state': 'employerState',
  'employer.address.zip': 'employerZip',
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const caseInsuranceFormFieldFor = (path: string): string => FIELDS[path] ?? path

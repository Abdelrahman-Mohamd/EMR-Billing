import { z } from 'zod'
import { showPhone, type Patient } from '../model/patient'
import type { GuarantorPayload, PatientPayload, PatientUpdatePayload } from './patient'

/** Nine digits, dashes optional: 123-45-6789. Whether it is a real SSN is the server's to say. */
export const SSN_PATTERN = /^\d{3}-?\d{2}-?\d{4}$/
/** Ten digits, punctuation allowed: 718-555-0100, (718) 555-0100. */
export const PHONE_PATTERN = /^[\s().+-]*(?:\d[\s().-]*){10}$/
export const STATE_PATTERN = /^[A-Z]{2}$/
export const ZIP_PATTERN = /^\d{5}$/
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** The server's name lengths. */
export const NAME_LIMITS = { first: 35, middle: 25 } as const

/** "Who receives statements": the patient, or another person (the guarantor). */
export const GUARANTOR_TYPES = [
  { value: 'self', label: 'The patient' },
  { value: 'other', label: 'Another person' },
] as const

const digits = (value: string) => value.replace(/\D/g, '')

/**
 * What the patient form accepts — as the server does:
 * - **Practice** (new patients only), **first and last name** (first at most
 *   35 characters, middle 25), **date of birth** (not in the future),
 *   **gender**, **street, city, state, ZIP**: required. State two capitals,
 *   ZIP five digits.
 * - **EMR ID**, **SSN**, **phones**, **email**: optional; when given, a
 *   number, nine digits (whether it is a real SSN the server says), ten-digit
 *   phones and an email address.
 * - **Guarantor**: when another person receives the statements, their first
 *   and last name and relationship are required; their date of birth (not in
 *   the future) and address are optional — but an address takes all four
 *   parts.
 *
 * Every check runs in one pass, so all messages show at once.
 */
export function patientFormSchema({ isNew, today }: { isNew: boolean; today: string }) {
  return z
    .object({
      practiceId: z.string().nullable(),
      emrId: z.string().trim(),
      firstName: z.string().trim(),
      middleName: z.string().trim(),
      lastName: z.string().trim(),
      dob: z.string(),
      gender: z.string().nullable(),
      ssn: z.string().trim(),
      phoneCell: z.string().trim(),
      phoneHome: z.string().trim(),
      email: z.string().trim(),
      line1: z.string().trim(),
      line2: z.string().trim(),
      city: z.string().trim(),
      state: z.string().trim().toUpperCase(),
      zip: z.string().trim(),
      guarantorType: z.enum(['self', 'other']),
      guarantorFirstName: z.string().trim(),
      guarantorLastName: z.string().trim(),
      guarantorRelationship: z.string().nullable(),
      guarantorDob: z.string(),
      guarantorLine1: z.string().trim(),
      guarantorCity: z.string().trim(),
      guarantorState: z.string().trim().toUpperCase(),
      guarantorZip: z.string().trim(),
      notes: z.string().trim(),
      noStatements: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      const required = (path: keyof typeof v, message: string) => {
        if (v[path] === '' || v[path] === null) issue(path, message)
      }
      const format = (path: keyof typeof v, pattern: RegExp, message: string) => {
        const value = v[path]
        if (typeof value === 'string' && value !== '' && !pattern.test(value)) issue(path, message)
      }
      const notAfterToday = (path: 'dob' | 'guarantorDob') => {
        if (v[path] !== '' && v[path] > today) issue(path, 'Please enter a valid date.')
      }

      if (isNew) required('practiceId', 'Select a practice.')
      format('emrId', /^\d+$/, 'Please enter a valid EMR ID.')
      required('firstName', 'Enter the first name.')
      if (v.firstName.length > NAME_LIMITS.first)
        issue('firstName', `Use at most ${NAME_LIMITS.first} characters.`)
      if (v.middleName.length > NAME_LIMITS.middle)
        issue('middleName', `Use at most ${NAME_LIMITS.middle} characters.`)
      required('lastName', 'Enter the last name.')
      required('dob', 'Enter the date of birth.')
      notAfterToday('dob')
      required('gender', 'Select a gender.')
      format('ssn', SSN_PATTERN, 'Please enter a valid SSN.')
      format('phoneCell', PHONE_PATTERN, 'Please enter a valid phone number.')
      format('phoneHome', PHONE_PATTERN, 'Please enter a valid phone number.')
      format('email', EMAIL_PATTERN, 'Please enter a valid email address.')
      required('line1', 'Enter the street address.')
      required('city', 'Enter the city.')
      required('state', 'Enter the state.')
      format('state', STATE_PATTERN, 'Please enter a valid state.')
      required('zip', 'Enter the ZIP code.')
      format('zip', ZIP_PATTERN, 'Please enter a valid ZIP code.')

      if (v.guarantorType === 'other') {
        required('guarantorFirstName', 'Enter the guarantor’s first name.')
        required('guarantorLastName', 'Enter the guarantor’s last name.')
        required('guarantorRelationship', 'Select the relationship.')
        notAfterToday('guarantorDob')
        // An address is optional, but once begun it needs every part.
        if (
          [v.guarantorLine1, v.guarantorCity, v.guarantorState, v.guarantorZip].some((part) => part !== '')
        ) {
          required('guarantorLine1', 'Enter the guarantor’s address.')
          required('guarantorCity', 'Enter the city.')
          required('guarantorState', 'Enter the state.')
          required('guarantorZip', 'Enter the ZIP code.')
        }
        format('guarantorState', STATE_PATTERN, 'Please enter a valid state.')
        format('guarantorZip', ZIP_PATTERN, 'Please enter a valid ZIP code.')
      }
    })
}

export type PatientFormValues = z.infer<ReturnType<typeof patientFormSchema>>

/** A new patient starts as the prototype's form does: the patient receives the statements, state NY. */
export function newPatientValues(practiceId: string | null): PatientFormValues {
  return {
    practiceId,
    emrId: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    gender: null,
    ssn: '',
    phoneCell: '',
    phoneHome: '',
    email: '',
    line1: '',
    line2: '',
    city: '',
    state: 'NY',
    zip: '',
    guarantorType: 'self',
    guarantorFirstName: '',
    guarantorLastName: '',
    guarantorRelationship: null,
    guarantorDob: '',
    guarantorLine1: '',
    guarantorCity: '',
    guarantorState: '',
    guarantorZip: '',
    notes: '',
    noStatements: false,
  }
}

/** A saved patient as the form holds them. The SSN is never put back in a field: it stays on file unless replaced. */
export function toPatientFormValues(patient: Patient): PatientFormValues {
  const guarantor = patient.guarantor
  return {
    practiceId: String(patient.practiceId),
    emrId: patient.emrId === null ? '' : String(patient.emrId),
    firstName: patient.firstName,
    middleName: patient.middleName,
    lastName: patient.lastName,
    dob: patient.dob,
    gender: patient.gender === '' ? null : patient.gender,
    ssn: '',
    phoneCell: showPhone(patient.phoneCell),
    phoneHome: showPhone(patient.phoneHome),
    email: patient.email,
    line1: patient.address.line1,
    line2: patient.address.line2,
    city: patient.address.city,
    state: patient.address.state,
    zip: patient.address.zip,
    guarantorType: guarantor === null ? 'self' : 'other',
    guarantorFirstName: guarantor?.firstName ?? '',
    guarantorLastName: guarantor?.lastName ?? '',
    guarantorRelationship:
      guarantor === null || guarantor.relationship === '' ? null : guarantor.relationship,
    guarantorDob: guarantor?.dob ?? '',
    guarantorLine1: guarantor?.address?.line1 ?? '',
    guarantorCity: guarantor?.address?.city ?? '',
    guarantorState: guarantor?.address?.state ?? '',
    guarantorZip: guarantor?.address?.zip ?? '',
    notes: patient.notes,
    noStatements: patient.noStatements,
  }
}

const orNull = (value: string) => (value === '' ? null : value)

function guarantorPayload(values: PatientFormValues): GuarantorPayload | null {
  if (values.guarantorType !== 'other') return null
  return {
    first_name: values.guarantorFirstName,
    last_name: values.guarantorLastName,
    relationship: values.guarantorRelationship ?? '',
    date_of_birth: orNull(values.guarantorDob),
    address:
      values.guarantorLine1 === ''
        ? null
        : {
            line1: values.guarantorLine1,
            city: values.guarantorCity,
            state: values.guarantorState,
            zip: values.guarantorZip,
          },
  }
}

/**
 * A save. "The patient" keeps no guarantor, as in the prototype; phones go as
 * their digits; the SSN only when one was typed — an empty one would erase the
 * SSN on file.
 */
export function toPatientUpdatePayload(values: PatientFormValues): PatientUpdatePayload {
  // The schema has refused a missing gender before this runs.
  return {
    emr_id: values.emrId === '' ? null : Number(values.emrId),
    first_name: values.firstName,
    middle_name: orNull(values.middleName),
    last_name: values.lastName,
    date_of_birth: values.dob,
    gender: values.gender ?? '',
    ...(values.ssn === '' ? {} : { ssn: values.ssn }),
    address: values.line1,
    address_line2: orNull(values.line2),
    city: values.city,
    state: values.state,
    zip_code: values.zip,
    phone_home: orNull(digits(values.phoneHome)),
    phone_cell: orNull(digits(values.phoneCell)),
    email: orNull(values.email),
    guarantor: guarantorPayload(values),
    notes: orNull(values.notes),
    no_statements: values.noStatements,
  }
}

/** A new patient: with their practice. */
export function toPatientPayload(values: PatientFormValues): PatientPayload {
  // The schema has refused a missing practice before this runs.
  return { practice_id: Number(values.practiceId), ...toPatientUpdatePayload(values) }
}

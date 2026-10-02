import { z } from 'zod'
import type { PatientValues } from '../data/patient-records-store'
import type { Patient } from '../model/patient'

/** The prototype's format checks — and only those. */
export const SSN_PATTERN = /^\d{3}-\d{2}-\d{4}$/
export const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/
export const STATE_PATTERN = /^[A-Z]{2}$/
export const ZIP_PATTERN = /^\d{5}$/
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** "Who receives statements": the patient, or another person (the guarantor). */
export const GUARANTOR_TYPES = [
  { value: 'self', label: 'The patient' },
  { value: 'other', label: 'Another person' },
] as const

/**
 * What the patient form accepts — the prototype's checks:
 * - **Practice** (new patients only), **first and last name**, **date of
 *   birth** (not in the future), **gender**, **street, city, state, ZIP**:
 *   required. State two capitals, ZIP five digits.
 * - **SSN**, **phones**, **email**: optional; when given, in the prototype's
 *   formats (000-00-0000, 718-555-0100, name@example.com).
 * - **Guarantor**: when another person receives the statements, their name,
 *   relationship and address (street, city, state, ZIP) are required.
 *
 * Every check runs in one pass, so all messages show at once.
 */
export function patientFormSchema({ isNew, today }: { isNew: boolean; today: string }) {
  return z
    .object({
      practiceId: z.string().nullable(),
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
      guarantorName: z.string().trim(),
      guarantorRelationship: z.string().nullable(),
      guarantorLine1: z.string().trim(),
      guarantorCity: z.string().trim(),
      guarantorState: z.string().trim().toUpperCase(),
      guarantorZip: z.string().trim(),
      notes: z.string().trim(),
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

      if (isNew) required('practiceId', 'Select a practice.')
      required('firstName', 'Enter the first name.')
      required('lastName', 'Enter the last name.')
      required('dob', 'Enter the date of birth.')
      if (v.dob !== '' && v.dob > today) issue('dob', 'Please enter a valid date.')
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
        required('guarantorName', 'Enter the guarantor’s name.')
        required('guarantorRelationship', 'Select the relationship.')
        required('guarantorLine1', 'Enter the guarantor’s address.')
        required('guarantorCity', 'Enter the city.')
        required('guarantorState', 'Enter the state.')
        format('guarantorState', STATE_PATTERN, 'Please enter a valid state.')
        required('guarantorZip', 'Enter the ZIP code.')
        format('guarantorZip', ZIP_PATTERN, 'Please enter a valid ZIP code.')
      }
    })
}

export type PatientFormValues = z.infer<ReturnType<typeof patientFormSchema>>

/** A new patient starts as the prototype's form does: the patient receives the statements, state NY. */
export function newPatientValues(practiceId: string | null): PatientFormValues {
  return {
    practiceId,
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
    guarantorName: '',
    guarantorRelationship: null,
    guarantorLine1: '',
    guarantorCity: '',
    guarantorState: '',
    guarantorZip: '',
    notes: '',
  }
}

/** A saved patient as the form holds it. The SSN is never put back in a field: it stays on file unless replaced. */
export function toPatientFormValues(patient: Patient): PatientFormValues {
  const guarantor = patient.guarantor
  return {
    practiceId: String(patient.practiceId),
    firstName: patient.firstName,
    middleName: patient.middleName,
    lastName: patient.lastName,
    dob: patient.dob,
    gender: patient.gender === '' ? null : patient.gender,
    ssn: '',
    phoneCell: patient.phoneCell,
    phoneHome: patient.phoneHome,
    email: patient.email,
    line1: patient.address.line1,
    line2: patient.address.line2,
    city: patient.address.city,
    state: patient.address.state,
    zip: patient.address.zip,
    guarantorType: guarantor === null ? 'self' : 'other',
    guarantorName: guarantor?.name ?? '',
    guarantorRelationship: guarantor?.relationship ?? null,
    guarantorLine1: guarantor?.address.line1 ?? '',
    guarantorCity: guarantor?.address.city ?? '',
    guarantorState: guarantor?.address.state ?? '',
    guarantorZip: guarantor?.address.zip ?? '',
    notes: patient.notes,
  }
}

/** The values the schema accepted, as a patient. "The patient" keeps no guarantor, as in the prototype. */
export function toPatientValues(values: PatientFormValues, practiceId: number): PatientValues {
  return {
    practiceId,
    firstName: values.firstName,
    middleName: values.middleName,
    lastName: values.lastName,
    dob: values.dob,
    gender: values.gender ?? '',
    ssn: values.ssn,
    phoneCell: values.phoneCell,
    phoneHome: values.phoneHome,
    email: values.email,
    address: {
      line1: values.line1,
      line2: values.line2,
      city: values.city,
      state: values.state,
      zip: values.zip,
    },
    guarantor:
      values.guarantorType === 'other'
        ? {
            name: values.guarantorName,
            relationship: values.guarantorRelationship ?? '',
            address: {
              line1: values.guarantorLine1,
              city: values.guarantorCity,
              state: values.guarantorState,
              zip: values.guarantorZip,
            },
          }
        : null,
    notes: values.notes,
  }
}

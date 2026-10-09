import { z } from 'zod'
import { AUTO, type PatientCase } from '../model/case'
import type { PatientCasePayload, PatientCaseUpdatePayload } from './patient-case'
import { STATE_PATTERN } from './patient-form'

/** The server's longest case name. */
export const CASE_NAME_MAX = 100

/**
 * What the case form accepts — as the server does:
 * - **Case name**: required, at most 100 characters (unique for the patient —
 *   the server's to say).
 * - **Referring physician**: optional.
 * - **Accident state**: required for an auto accident (Box 10b); two capitals.
 * - **Injury / onset date**: not in the future; **discharge date**: not before
 *   the start of care.
 */
export function caseFormSchema(today: string) {
  return z
    .object({
      name: z.string().trim(),
      referrerId: z.string().nullable(),
      injuryType: z.string().nullable(),
      injuryDate: z.string(),
      accidentState: z.string().trim().toUpperCase(),
      startOfCare: z.string(),
      dischargeDate: z.string(),
      isActive: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.name === '') issue('name', 'Enter the case name.')
      else if (v.name.length > CASE_NAME_MAX) issue('name', `Use at most ${CASE_NAME_MAX} characters.`)
      if (v.injuryDate !== '' && v.injuryDate > today) issue('injuryDate', 'Please enter a valid date.')
      if (v.injuryType === AUTO && v.accidentState === '') issue('accidentState', 'Enter the accident state.')
      else if (v.accidentState !== '' && !STATE_PATTERN.test(v.accidentState))
        issue('accidentState', 'Please enter a valid state.')
      if (v.startOfCare !== '' && v.dischargeDate !== '' && v.dischargeDate < v.startOfCare)
        issue('dischargeDate', 'Please enter a valid date.')
    })
}

export type CaseFormValues = z.infer<ReturnType<typeof caseFormSchema>>

/** A new case starts open, not related to an injury, cared for from today — as in the prototype. */
export function newCaseValues(today: string): CaseFormValues {
  return {
    name: '',
    referrerId: null,
    injuryType: null,
    injuryDate: '',
    accidentState: '',
    startOfCare: today,
    dischargeDate: '',
    isActive: true,
  }
}

export function toCaseFormValues(item: PatientCase): CaseFormValues {
  return {
    name: item.name,
    referrerId: item.referrerId === null ? null : String(item.referrerId),
    injuryType: item.injuryType === '' ? null : item.injuryType,
    injuryDate: item.injuryDate,
    accidentState: item.accidentState,
    startOfCare: item.startOfCare,
    dischargeDate: item.dischargeDate,
    isActive: item.isActive,
  }
}

const orNull = (value: string) => (value === '' ? null : value)

/**
 * A save, as the prototype saves it: with no related cause the accident state
 * is cleared, as its field closes; the injury date stays only when the payer
 * asks for it.
 */
export function toCaseUpdatePayload(
  values: CaseFormValues,
  injuryDateRequired: boolean,
): PatientCaseUpdatePayload {
  const cause = values.injuryType ?? ''
  return {
    name: values.name,
    referring_physician_id: values.referrerId === null ? null : Number(values.referrerId),
    injury_type: orNull(cause),
    injury_date: cause !== '' || injuryDateRequired ? orNull(values.injuryDate) : null,
    accident_state: cause !== '' ? orNull(values.accidentState) : null,
    start_of_care: orNull(values.startOfCare),
    discharge_date: orNull(values.dischargeDate),
    is_active: values.isActive,
  }
}

/** A new case: for its patient. */
export function toCasePayload(
  patientId: string,
  values: CaseFormValues,
  injuryDateRequired: boolean,
): PatientCasePayload {
  return { patient_id: Number(patientId), ...toCaseUpdatePayload(values, injuryDateRequired) }
}

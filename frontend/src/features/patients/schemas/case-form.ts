import { z } from 'zod'
import type { CaseValues } from '../data/patient-records-store'
import { AUTO, type PatientCase } from '../model/case'
import { STATE_PATTERN } from './patient-form'

/**
 * What the case form accepts — the prototype's checks:
 * - **Case name**, **referring physician**, **primary insurance**: required.
 * - **Secondary insurance**: optional, not the primary ("Choose a different
 *   insurance from the primary.").
 * - **Injury / onset date**: required when there is a related cause, or when
 *   the primary insurance requires it (Box 14).
 * - **Accident state**: required for an auto injury; two capitals.
 * - **Employment status**: required when the primary insurance is Workers'
 *   Comp.
 * - **Discharge date**: not before the start of care.
 *
 * What the chosen primary insurance requires is passed in, by coverage id.
 */
export function caseFormSchema(primary: {
  injuryDateRequired: (coverageId: string | null) => boolean
  isWorkersComp: (coverageId: string | null) => boolean
}) {
  return z
    .object({
      name: z.string().trim(),
      referrerId: z.string().nullable(),
      primaryCoverageId: z.string().nullable(),
      secondaryCoverageId: z.string().nullable(),
      injuryType: z.string().nullable(),
      injuryDate: z.string(),
      accidentState: z.string().trim().toUpperCase(),
      employmentStatus: z.string().trim(),
      startOfCare: z.string(),
      dischargeDate: z.string(),
      isActive: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.name === '') issue('name', 'Enter the case name.')
      if (v.referrerId === null) issue('referrerId', 'Select the referring physician.')
      if (v.primaryCoverageId === null) issue('primaryCoverageId', 'Select the primary insurance.')
      if (v.secondaryCoverageId !== null && v.secondaryCoverageId === v.primaryCoverageId)
        issue('secondaryCoverageId', 'Choose a different insurance from the primary.')
      const cause = v.injuryType !== null && v.injuryType !== ''
      if ((cause || primary.injuryDateRequired(v.primaryCoverageId)) && v.injuryDate === '')
        issue('injuryDate', 'Enter the injury or onset date.')
      if (v.injuryType === AUTO) {
        if (v.accidentState === '') issue('accidentState', 'Enter the accident state.')
        else if (!STATE_PATTERN.test(v.accidentState)) issue('accidentState', 'Please enter a valid state.')
      }
      if (primary.isWorkersComp(v.primaryCoverageId) && v.employmentStatus === '')
        issue('employmentStatus', 'Enter the employment status.')
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
    primaryCoverageId: null,
    secondaryCoverageId: null,
    injuryType: null,
    injuryDate: '',
    accidentState: '',
    employmentStatus: '',
    startOfCare: today,
    dischargeDate: '',
    isActive: true,
  }
}

export function toCaseFormValues(item: PatientCase): CaseFormValues {
  return {
    name: item.name,
    referrerId: item.referrerId === null ? null : String(item.referrerId),
    primaryCoverageId: item.primaryCoverageId,
    secondaryCoverageId: item.secondaryCoverageId,
    injuryType: item.injuryType === '' ? null : item.injuryType,
    injuryDate: item.injuryDate,
    accidentState: item.accidentState,
    employmentStatus: item.employmentStatus,
    startOfCare: item.startOfCare,
    dischargeDate: item.dischargeDate,
    isActive: item.isActive,
  }
}

/**
 * As the prototype saves it. With no related cause the accident state is
 * cleared, as its field closes; the injury date stays only when the payer asks
 * for it.
 */
export function toCaseValues(values: CaseFormValues, injuryDateRequired: boolean): CaseValues {
  const cause = values.injuryType ?? ''
  return {
    name: values.name,
    referrerId: values.referrerId === null ? null : Number(values.referrerId),
    primaryCoverageId: values.primaryCoverageId,
    secondaryCoverageId: values.secondaryCoverageId,
    injuryType: cause,
    injuryDate: cause !== '' || injuryDateRequired ? values.injuryDate : '',
    accidentState: cause !== '' ? values.accidentState : '',
    employmentStatus: values.employmentStatus,
    startOfCare: values.startOfCare,
    dischargeDate: values.dischargeDate,
    isActive: values.isActive,
  }
}

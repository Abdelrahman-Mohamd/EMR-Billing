import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/stores/toast-store'
import { useInsuranceClasses, useInsurances } from '@/features/admin-insurances'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { usePatientRecords } from '../../data/patient-records-store'
import { caseSearch, type PatientCase } from '../../model/case'
import { primaryOf } from '../../model/coverage'
import { effectiveRule } from '../../model/insurance-rules'
import { patientCaseKeys, useCreatePatientCase, useUpdatePatientCase } from '../../queries/use-patient-cases'
import type { ServerCase } from '../../schemas/patient-case'
import { toCasePayload, toCaseUpdatePayload } from '../../schemas/case-form'
import { CaseDialog, type PrimaryNeeds } from './CaseDialog'
import { scrollToSection } from './chart-scroll'

/**
 * New or edit a case — the dialog with what it needs from the other features
 * (the practice's referring physicians, and what the case's primary insurance
 * requires) and what saving does: the case goes to the server, the server's
 * message is shown, and a new case is chosen on the chart. The server returns
 * no new id: the new case is found by its name, which is unique for the
 * patient.
 */
export function CaseEditor({
  patientId,
  item,
  onClose,
}: {
  patientId: string
  /** `null` adds a case. */
  item: PatientCase | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const records = usePatientRecords()
  const insurances = useInsurances()
  const classes = useInsuranceClasses()
  const referrers = useReferringPhysicians()
  const create = useCreatePatientCase()
  const update = useUpdatePatientCase()
  const patient = records.patients.find((entry) => entry.id === patientId)
  if (patient === undefined) return null

  const practiceClasses = (classes.data ?? []).filter((entry) => entry.practiceId === patient.practiceId)
  const primaryCoverage = item === null ? undefined : primaryOf(records.coverages, item.id)
  const primaryInsurance = (insurances.data ?? []).find((entry) => entry.id === primaryCoverage?.insuranceId)
  const primary: PrimaryNeeds | undefined =
    primaryCoverage === undefined
      ? undefined
      : {
          injuryDateRequired: effectiveRule(primaryInsurance, practiceClasses, 'injuryDateRequired'),
          insuranceName: primaryCoverage.insuranceName || 'The primary insurance',
        }

  return (
    <CaseDialog
      key={item?.id ?? 'new'}
      item={item}
      referrers={(referrers.data ?? []).filter(
        (entry) =>
          entry.practiceId === patient.practiceId && (entry.isActive || entry.id === item?.referrerId),
      )}
      primary={primary}
      onSave={async (values, injuryDateRequired) => {
        if (item === null) {
          const message = await create.mutateAsync(toCasePayload(patient.id, values, injuryDateRequired))
          const created = queryClient
            .getQueryData<ServerCase[]>(patientCaseKeys.list())
            ?.find((entry) => entry.patientId === patient.id && entry.name === values.name)
          toast.success(message ?? 'Case created')
          if (created === undefined) return
          void navigate({
            to: '/patients/$patientId',
            params: { patientId: patient.id },
            search: { case: caseSearch(created.id) },
            resetScroll: false,
          }).then(() => requestAnimationFrame(() => scrollToSection('case')))
        } else {
          const message = await update.mutateAsync({
            id: item.id,
            payload: toCaseUpdatePayload(values, injuryDateRequired),
          })
          toast.success(message ?? 'Case saved')
        }
      }}
      onClose={onClose}
    />
  )
}

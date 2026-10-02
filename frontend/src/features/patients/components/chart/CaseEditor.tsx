import { useNavigate } from '@tanstack/react-router'
import { toast } from '@/stores/toast-store'
import { insuranceLabel, useInsuranceClasses, useInsurances } from '@/features/admin-insurances'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { usePatientRecords } from '../../data/patient-records-store'
import type { PatientCase } from '../../model/case'
import { WORKERS_COMP } from '../../model/coverage'
import { effectiveRule } from '../../model/insurance-rules'
import { toCaseValues } from '../../schemas/case-form'
import { CaseDialog, type CoverageOption } from './CaseDialog'
import { scrollToSection } from './chart-scroll'

/**
 * New or edit a case — the dialog with what it needs from the other features
 * (the practice's referring physicians, the patient's coverage and what each
 * insurance requires) and what saving does: the toast, and for a new case,
 * choosing it on the chart.
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
  const records = usePatientRecords()
  const insurances = useInsurances()
  const classes = useInsuranceClasses()
  const referrers = useReferringPhysicians()
  const patient = records.patients.find((entry) => entry.id === patientId)
  if (patient === undefined) return null

  const practiceClasses = (classes.data ?? []).filter((entry) => entry.practiceId === patient.practiceId)
  const coverageOptions: CoverageOption[] = records.coverages
    .filter((coverage) => coverage.patientId === patient.id)
    .map((coverage) => {
      const insurance = (insurances.data ?? []).find((entry) => entry.id === coverage.insuranceId)
      return {
        value: coverage.id,
        label: `${insurance === undefined ? 'Insurance' : insuranceLabel(insurance)} · member ${coverage.memberId || '—'}`,
        injuryDateRequired: effectiveRule(insurance, practiceClasses, 'injuryDateRequired'),
        isWorkersComp: insurance?.insuranceType === WORKERS_COMP,
        insuranceName: insurance?.name ?? 'The insurance',
      }
    })

  return (
    <CaseDialog
      key={item?.id ?? 'new'}
      item={item}
      referrers={(referrers.data ?? []).filter((entry) => entry.practiceId === patient.practiceId)}
      coverageOptions={coverageOptions}
      onSave={(values, injuryDateRequired) => {
        if (item === null) {
          const id = records.createCase(patient.id, toCaseValues(values, injuryDateRequired))
          toast.success('Case created')
          void navigate({
            to: '/patients/$patientId',
            params: { patientId: patient.id },
            search: { case: id },
            resetScroll: false,
          }).then(() => requestAnimationFrame(() => scrollToSection('case')))
        } else {
          records.updateCase(item.id, toCaseValues(values, injuryDateRequired))
          toast.success('Case saved')
        }
      }}
      onClose={onClose}
      onShowInsurance={() => {
        onClose()
        // After the dialog has gone and handed focus back, not before.
        requestAnimationFrame(() => scrollToSection('insurance'))
      }}
    />
  )
}

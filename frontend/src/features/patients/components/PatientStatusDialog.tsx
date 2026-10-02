import { Ban, RotateCcw } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { ConfirmDialog } from '@/components/ui/Dialog'
import type { Patient } from '../model/patient'

/**
 * The prototype's Deactivate / Reactivate of a patient, after a confirmation —
 * from the roster's Active switch or the chart's More menu.
 */
export function PatientStatusDialog({
  patient,
  onConfirm,
  onClose,
}: {
  patient: Patient
  onConfirm: (isActive: boolean) => void
  onClose: () => void
}) {
  const deactivating = patient.isActive
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={deactivating ? 'Deactivate this patient?' : 'Reactivate this patient?'}
      description={
        deactivating
          ? 'The patient is hidden from the active roster. Existing claims and balances are kept.'
          : 'The patient returns to the active roster.'
      }
      confirmLabel={deactivating ? 'Deactivate' : 'Reactivate'}
      tone={deactivating ? 'destructive' : 'default'}
      icon={deactivating ? <Ban size={20} /> : <RotateCcw size={20} />}
      onConfirm={() => {
        onConfirm(!patient.isActive)
        toast.success(deactivating ? 'Patient deactivated' : 'Patient reactivated')
      }}
    />
  )
}

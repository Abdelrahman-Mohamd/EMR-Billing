import { Ban, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { statusChangeFailed, statusChanged } from '@/components/ui/RowActions'
import { fullName, type PatientSummary } from '../model/patient'

/**
 * The prototype's Deactivate / Reactivate of a patient, after a confirmation —
 * from the roster's Active switch or the chart's More menu. Confirming waits
 * for the server with the button busy; the toast then carries the server's
 * message, or its reason when it refuses.
 */
export function PatientStatusDialog({
  patient,
  onConfirm,
  onClose,
}: {
  patient: PatientSummary
  /** The save; resolves with the server's message. */
  onConfirm: (isActive: boolean) => Promise<string | null>
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
      onConfirm={async () => {
        try {
          statusChanged(fullName(patient), !patient.isActive, await onConfirm(!patient.isActive))
        } catch (error) {
          statusChangeFailed(fullName(patient), !patient.isActive, error)
        }
      }}
    />
  )
}

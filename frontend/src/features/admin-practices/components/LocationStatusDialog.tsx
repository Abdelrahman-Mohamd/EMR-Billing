import { Ban, RotateCcw } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useSetLocationActive } from '../queries/use-practices'
import type { Location } from '../schemas/practice'

/**
 * The prototype's row action on a location: Deactivate, or Reactivate, after
 * a confirmation. It changes `is_active` and nothing else — the save carries
 * that field alone, and the server keeps the rest as it is.
 *
 * Deliberately left out: the prototype's refusal to deactivate the primary or
 * last active location (the payloads have no primary flag, and V2 only says a
 * practice needs a location, not an active one) and its claim that an
 * inactive location "can no longer be chosen for new cases or visits" — what
 * inactive means is open (Q-068). The server decides both.
 */
export function LocationStatusDialog({ location, onClose }: { location: Location; onClose: () => void }) {
  const update = useSetLocationActive()
  const deactivating = location.isActive

  const confirm = async () => {
    try {
      const message = await update.mutateAsync({ id: location.id, isActive: !location.isActive })
      toast.success(
        message ?? (deactivating ? `${location.name} deactivated` : `${location.name} reactivated`),
      )
    } catch (error) {
      toast.error(
        deactivating ? 'The location was not deactivated' : 'The location was not reactivated',
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={deactivating ? `Deactivate ${location.name}?` : `Reactivate ${location.name}?`}
      description={deactivating ? 'Its status becomes Inactive.' : 'Its status becomes Active again.'}
      confirmLabel={deactivating ? 'Deactivate' : 'Reactivate'}
      tone={deactivating ? 'destructive' : 'default'}
      icon={deactivating ? <Ban size={20} /> : <RotateCcw size={20} />}
      onConfirm={confirm}
    />
  )
}

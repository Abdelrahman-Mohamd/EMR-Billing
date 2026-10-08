import { Ban, RotateCcw } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useSetUserActive } from '../queries/use-users'
import type { User } from '../schemas/user'

/**
 * The prototype's row action on a user: Deactivate, or Reactivate, after a
 * confirmation. It changes `is_active` and nothing else — a save carrying the
 * user's name and email as they are, and no password. The switch shows the new
 * status as soon as the server has saved it.
 *
 * Deliberately not claimed: the prototype's "they can no longer sign in" —
 * what an inactive user can still do, and whether their sessions end, is not
 * defined. The server decides.
 */
export function UserStatusDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const update = useSetUserActive()
  const deactivating = user.isActive

  const confirm = async () => {
    try {
      const message = await update.mutateAsync({ user, isActive: !user.isActive })
      // The server's words; ours only when it sent none.
      toast.success(message ?? (deactivating ? `${user.name} deactivated` : `${user.name} reactivated`))
    } catch (error) {
      toast.error(
        deactivating ? 'The user was not deactivated' : 'The user was not reactivated',
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
      title={deactivating ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`}
      description={deactivating ? 'Their status becomes Inactive.' : 'Their status becomes Active again.'}
      confirmLabel={deactivating ? 'Deactivate user' : 'Reactivate user'}
      tone={deactivating ? 'destructive' : 'default'}
      icon={deactivating ? <Ban size={20} /> : <RotateCcw size={20} />}
      onConfirm={confirm}
    />
  )
}

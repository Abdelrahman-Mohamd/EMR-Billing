import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import type { BillingException } from '../model/billing-exception'
import { useReprocessException } from '../queries/use-billing-exceptions'

/**
 * Asks the server to re-check an exception's record (a reprocess) and says
 * what it found, in its words: cleared, or still there. After a fix, `label`
 * ("Patient updated") leads the toast and the server's answer follows it.
 *
 * An exception the server no longer has (404) was cleared already — the
 * fix's own save re-checked its record.
 */
export function useRecheck() {
  const reprocess = useReprocessException()
  return async (exception: BillingException, label?: string) => {
    try {
      const result = await reprocess.mutateAsync(exception.id)
      const said =
        result.message ?? (result.stillThere ? 'The problem is still there.' : 'Exception cleared.')
      if (result.stillThere) {
        if (label === undefined) toast.warning(said, exception.detail)
        else toast.warning(label, said)
      } else if (label === undefined) toast.success(said)
      else toast.success(label, said)
    } catch (error) {
      if (isApiError(error) && error.kind === 'not_found') {
        toast.success(label ?? 'Exception cleared', 'The exception is cleared.')
        return
      }
      toast.error(
        label === undefined ? 'The exception was not re-checked' : `${label} — not re-checked`,
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }
}

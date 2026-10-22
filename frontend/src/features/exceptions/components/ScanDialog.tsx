import { useState } from 'react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { useScanPractice } from '../queries/use-billing-exceptions'

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`

/**
 * "Scan practice": the server checks every patient and case of a practice
 * again, and every visit still in review — the queue rebuilt from the data as
 * it is now. For after a change no save re-checks: a payer's rules, a fee
 * schedule. It asks first; the practice in view is the one offered.
 */
export function ScanDialog({
  practiceId,
  onClose,
}: {
  /** The practice in view, or the first. */
  practiceId: number | undefined
  onClose: () => void
}) {
  const scan = useScanPractice()
  const practices = usePractices()
  const [picked, setChosen] = useState<string | null>(practiceId === undefined ? null : String(practiceId))
  const first = practices.data?.[0]
  const chosen = picked ?? (first === undefined ? null : String(first.id))
  const [failure, setFailure] = useState<string | null>(null)

  const run = async () => {
    if (chosen === null) return
    setFailure(null)
    try {
      const result = await scan.mutateAsync(Number(chosen))
      const { patients, cases, visits, exceptions } = result.counts
      toast.success(
        result.message ?? 'Practice scanned',
        `${plural(patients, 'patient')}, ${plural(cases, 'case')} and ${plural(visits, 'visit')} checked: ${plural(exceptions, 'exception')}.`,
      )
      onClose()
    } catch (error) {
      setFailure(isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Scan for billing exceptions"
      description="Every patient and case of the practice, and every visit still in review, is checked again. Use it after changing payer rules or fee schedules."
      size="sm"
      dismissible={!scan.isPending}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={scan.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void run()}
            loading={scan.isPending}
            disabled={chosen === null}
          >
            Scan practice
          </Button>
        </>
      }
    >
      <Field label="Practice" required>
        <PracticeSelect value={chosen} onChange={setChosen} disabled={scan.isPending} />
      </Field>
      {failure !== null && (
        <Notice tone="critical" className="mt-4">
          {failure}
        </Notice>
      )}
    </Dialog>
  )
}

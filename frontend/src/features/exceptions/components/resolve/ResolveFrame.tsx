import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Notice } from '@/components/ui/Notice'
import type { BillingException } from '../../model/billing-exception'

/**
 * The prototype's Resolve dialog around every fix form: what to fix and why,
 * the exception itself ("Patient · ZIP code mismatch with state." and its
 * particulars), the form, then Cancel and "Save and re-check".
 */
export function ResolveFrame({
  exception,
  title,
  description,
  formId,
  busy = false,
  failure = null,
  onClose,
  children,
}: {
  exception: BillingException
  title: string
  description: string
  /** The form's id, so the footer's button submits it. */
  formId: string
  /** While a save is on its way: the dialog stays, the buttons wait. */
  busy?: boolean
  /** Why the save failed, in the user's terms; shown under the form. */
  failure?: string | null
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      description={description}
      size="md"
      dismissible={!busy}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            Save and re-check
          </Button>
        </>
      }
    >
      <Notice tone="critical" title={`${exception.level} · ${exception.trigger}.`}>
        {exception.detail}
      </Notice>
      <div className="mt-4">{children}</div>
      {failure !== null && (
        <Notice tone="critical" className="mt-4">
          {failure}
        </Notice>
      )}
    </Dialog>
  )
}

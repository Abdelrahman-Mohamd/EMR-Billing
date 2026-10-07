import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, applyServerErrors } from '@/components/ui/Form'
import { Notice } from '@/components/ui/Notice'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { formatIsoDate } from '@/lib/utils/dates'
import { useAddChargeLine } from '../queries/use-visits'
import { useVisitReferences } from '../queries/use-visit-references'
import {
  chargeLineFormSchema,
  newChargeLineValues,
  toCreateChargeLinePayload,
  type ChargeLineFormValues,
} from '../schemas/visit-form'
import type { Visit } from '../schemas/visit'
import { ChargeLineFields } from './ChargeLineFields'

/** Add a charge line to a visit — the charge-line payload, with the visit it belongs to. */
export function AddChargeLineDialog({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const formId = useId()
  const refs = useVisitReferences()
  const add = useAddChargeLine()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ChargeLineFormValues>({
    resolver: zodResolver(chargeLineFormSchema),
    defaultValues: newChargeLineValues(),
  })
  const item = refs.caseOf(visit.caseId)
  const diagnoses =
    item === undefined ? [] : item.diagnoses.map((diagnosis, index) => ({ pointer: index + 1, ...diagnosis }))

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Add charge line"
      description={`${refs.patientFullName(visit.caseId)} · ${formatIsoDate(visit.dateOfService)}`}
      size="md"
      dismissible={!add.isPending}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={add.isPending}>
            Add charge line
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          try {
            await add.mutateAsync(toCreateChargeLinePayload(visit.id, values))
            toast.success('Charge line added')
            onClose()
          } catch (error) {
            const leftover = applyServerErrors(form, error)
            setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
          }
        }}
      >
        <FormGrid>
          <ChargeLineFields codes={refs.codes} diagnoses={diagnoses} />
        </FormGrid>
        {failure !== null && (
          <Notice tone="critical" className="mt-4">
            {failure}
          </Notice>
        )}
      </Form>
    </Dialog>
  )
}

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
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { useUpdateVisit } from '../queries/use-visits'
import { useVisitReferences } from '../queries/use-visit-references'
import {
  editVisitFormSchema,
  toEditVisitValues,
  toUpdateVisitPayload,
  type EditVisitFormValues,
} from '../schemas/visit-form'
import type { Visit } from '../schemas/visit'
import { VisitFields } from './VisitFields'

/**
 * Edit a visit not yet released: what a save may change — the date of service,
 * location, providers, authorization and diagnoses. Its case and charge lines
 * stay (the server refuses them on a save). The save waits for the server: its field
 * errors land on the fields, anything else shows above the form.
 */
export function EditVisitDialog({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const formId = useId()
  const refs = useVisitReferences()
  const update = useUpdateVisit()
  const today = todayIso()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<EditVisitFormValues>({
    resolver: zodResolver(editVisitFormSchema(today)),
    defaultValues: toEditVisitValues(visit),
  })
  const submitting = update.isPending

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Edit visit"
      description={`${refs.patientFullName(visit)} · ${visit.caseName} · ${formatIsoDate(visit.dateOfService)}`}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            Save visit
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
            const message = await update.mutateAsync({ id: visit.id, payload: toUpdateVisitPayload(values) })
            toast.success(message ?? 'Visit saved')
            onClose()
          } catch (error) {
            const leftover = applyServerErrors(form, error)
            setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
          }
        }}
      >
        <FormGrid>
          {failure !== null && (
            <div className="col-span-12">
              <Notice tone="critical">{failure}</Notice>
            </div>
          )}
          <VisitFields
            refs={refs}
            caseId={visit.caseId}
            today={today}
            disabled={submitting}
            savedCodes={visit.diagnosisCodes}
          />
        </FormGrid>
      </Form>
    </Dialog>
  )
}

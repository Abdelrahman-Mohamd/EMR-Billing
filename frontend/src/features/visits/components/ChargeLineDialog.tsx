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
import { useAddChargeLine, useUpdateChargeLine } from '../queries/use-visits'
import { useVisitReferences } from '../queries/use-visit-references'
import {
  chargeLineFormSchema,
  newChargeLineValues,
  toChargeLineFormValues,
  toChargeLinePayload,
  toChargeLineUpdatePayload,
  type ChargeLineFormValues,
} from '../schemas/visit-form'
import type { ChargeLine, Visit } from '../schemas/visit'
import { ChargeLineFields, type DiagnosisOption } from './ChargeLineFields'

/**
 * Add a charge line to a visit not yet released, or edit one of its lines —
 * procedure code, units, modifiers, diagnosis pointers, place of service and
 * notes. The pointers name the visit's own copy of the case's diagnoses. The
 * save waits for the server: its field errors land on the fields, anything
 * else (a pointer past the visit's diagnoses) shows above the form.
 */
export function ChargeLineDialog({
  visit,
  line,
  onClose,
}: {
  visit: Visit
  /** `null` adds a line. */
  line: ChargeLine | null
  onClose: () => void
}) {
  const formId = useId()
  const refs = useVisitReferences()
  const add = useAddChargeLine()
  const update = useUpdateChargeLine()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ChargeLineFormValues>({
    resolver: zodResolver(chargeLineFormSchema),
    defaultValues: line === null ? newChargeLineValues() : toChargeLineFormValues(line),
  })
  const submitting = add.isPending || update.isPending
  // The visit's diagnoses, with what the case's codes read as where known.
  const caseDiagnoses = refs.records.cases.find((item) => item.id === visit.caseId)?.diagnoses ?? []
  const diagnoses: DiagnosisOption[] = visit.diagnosisCodes.map((code, index) => ({
    pointer: index + 1,
    code,
    description: caseDiagnoses.find((diagnosis) => diagnosis.code === code)?.description ?? '',
  }))

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={line === null ? 'Add charge line' : 'Edit charge line'}
      description={`${refs.patientFullName(visit)} · ${formatIsoDate(visit.dateOfService)}`}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {line === null ? 'Add charge line' : 'Save charge line'}
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
            const message =
              line === null
                ? await add.mutateAsync(toChargeLinePayload(visit.id, values))
                : await update.mutateAsync({ id: line.id, payload: toChargeLineUpdatePayload(values) })
            toast.success(message ?? (line === null ? 'Charge line added' : 'Charge line saved'))
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
          <ChargeLineFields
            codes={refs.codes}
            diagnoses={diagnoses}
            {...(line === null ? {} : { keepCodeId: line.procedureCodeId })}
          />
        </FormGrid>
      </Form>
    </Dialog>
  )
}

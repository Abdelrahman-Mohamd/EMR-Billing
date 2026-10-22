import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { MAX_DIAGNOSES, type Diagnosis } from '../../model/case'
import {
  DESCRIPTION_MAX,
  caseDiagnosisFormSchema,
  type CaseDiagnosisFormValues,
} from '../../schemas/case-diagnosis'

/**
 * Add or edit one of a case's diagnoses: its ICD-10-CM code and a
 * description, as the server takes them. A new one takes the next pointer.
 * The save waits for the server: whether the code is a real ICD-10-CM code,
 * and whether the case already has it, land on the code; anything else (the
 * case's 12) shows above the form.
 */
export function DiagnosisDialog({
  diagnosis,
  pointer,
  onSave,
  onClose,
}: {
  /** `null` adds a diagnosis. */
  diagnosis: Diagnosis | null
  /** Its position, 1–12. */
  pointer: number
  /** Resolves with the server's message. */
  onSave: (values: CaseDiagnosisFormValues) => Promise<unknown>
  onClose: () => void
}) {
  const formId = useId()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<CaseDiagnosisFormValues>({
    resolver: zodResolver(caseDiagnosisFormSchema),
    defaultValues: { code: diagnosis?.code ?? '', description: diagnosis?.description ?? '' },
  })
  const submitting = form.formState.isSubmitting

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={diagnosis === null ? 'Add diagnosis' : 'Edit diagnosis'}
      description={`Pointer ${pointer} of ${MAX_DIAGNOSES}.`}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {diagnosis === null ? 'Add diagnosis' : 'Save diagnosis'}
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
            await onSave(values)
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
          <FormField
            name="code"
            label="ICD-10 code"
            required
            span={4}
            info="An ICD-10-CM code, e.g. M54.2. Once per case."
          >
            {(field) => (
              <Input
                {...field}
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                placeholder="Enter ICD-10 code"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="description" label="Description" span={8}>
            {(field) => (
              <Input
                {...field}
                value={typeof field.value === 'string' ? field.value : ''}
                placeholder="Enter description"
                autoComplete="off"
                maxLength={DESCRIPTION_MAX}
                readOnly={submitting}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

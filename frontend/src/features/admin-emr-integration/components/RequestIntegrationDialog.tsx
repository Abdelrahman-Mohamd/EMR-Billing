import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input, Textarea } from '@/components/ui/Input'
import { requestFormSchema, type RequestFormValues } from '../schemas/request-form'

/**
 * The prototype's Request integration dialog for one location: the Unique
 * Location ID it shares with its EMR twin, and an optional note for the
 * approver. Sending it marks the location Requested; it is linked only once
 * approved.
 */
export function RequestIntegrationDialog({
  locationName,
  isTaken,
  onSend,
  onClose,
}: {
  locationName: string
  /** Whether another location already holds an id. */
  isTaken: (uniqueLocationId: string) => boolean
  onSend: (values: RequestFormValues) => void
  onClose: () => void
}) {
  const formId = useId()
  const schema = useMemo(() => requestFormSchema(isTaken), [isTaken])
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { uniqueLocationId: '', note: '' },
  })

  const onSubmit = (values: RequestFormValues) => {
    onSend(values)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Request integration — ${locationName}`}
      description="The shared Unique Location ID maps this location 1:1 to the same location in the EMR."
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Send request
          </Button>
        </>
      }
    >
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
          <FormField name="uniqueLocationId" label="Unique Location ID" required span={12}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter Unique Location ID"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            )}
          </FormField>
          <FormField name="note" label="Note for the approver" span={12}>
            {(field) => <Textarea {...field} rows={2} placeholder="Enter a note (optional)" />}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

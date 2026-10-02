import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AUTH_UNITS } from '../../model/authorization'
import {
  authorizationFormSchema,
  newAuthorizationValues,
  type AuthorizationFormValues,
} from '../../schemas/authorization-form'

/**
 * The prototype's "Add authorization": who issued it (the case's primary or
 * secondary insurance), its number, the dates it covers, and how many visits
 * or units were approved.
 */
export function AuthorizationDialog({
  issuers,
  onSave,
  onClose,
}: {
  /** The case's coverage: "Aetna (primary)". */
  issuers: ReadonlyArray<{ value: string; label: string }>
  onSave: (values: AuthorizationFormValues) => void
  onClose: () => void
}) {
  const formId = useId()
  const form = useForm<AuthorizationFormValues>({
    resolver: zodResolver(authorizationFormSchema),
    defaultValues: newAuthorizationValues(issuers[0]?.value ?? null),
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Add authorization"
      description="A payer’s pre-approval for a number of visits or units within a date range."
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Save authorization
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          onSave(values)
          onClose()
        }}
      >
        <FormGrid>
          <FormField name="coverageId" label="Issued by" required span={12}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={issuers}
              />
            )}
          </FormField>
          <FormField name="number" label="Authorization number" required span={12}>
            {(field) => <Input {...field} placeholder="Enter authorization number" autoComplete="off" />}
          </FormField>
          <FormField name="start" label="Start date" required span={6}>
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FormField>
          <FormField name="end" label="End date" required span={6}>
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FormField>
          <FormField name="qty" label="Approved" required span={6}>
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                step={1}
                placeholder="Enter number approved"
              />
            )}
          </FormField>
          <FormField name="unit" label="Unit" required span={6}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => {
                  const unit = AUTH_UNITS.find((option) => option === next)
                  if (unit !== undefined) field.onChange(unit)
                }}
                options={AUTH_UNITS.map((value) => ({ value, label: value }))}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

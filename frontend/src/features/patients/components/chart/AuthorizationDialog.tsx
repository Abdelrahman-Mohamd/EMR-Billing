import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { AUTH_UNITS, type Authorization } from '../../model/authorization'
import {
  AUTH_NUMBER_MAX,
  AUTH_QTY_MAX,
  authorizationFormSchema,
  newAuthorizationValues,
  toAuthorizationFormValues,
  type AuthorizationFormValues,
} from '../../schemas/authorization-form'

/**
 * Add or edit an authorization, to the server's rules: the insurance that
 * issued it (one of the case's; fixed once saved — the server refuses a
 * change), its number, the dates it covers, and how many visits or units were
 * approved. The save waits for the server: its field errors land on the
 * fields, anything else (the dates' order on a save) shows above the form.
 */
export function AuthorizationDialog({
  authorization,
  issuers,
  onSave,
  onClose,
}: {
  /** `null` adds an authorization. */
  authorization: Authorization | null
  /** The case's insurances: "1039 – Corvel Enterprise (primary)". */
  issuers: ReadonlyArray<{ value: string; label: string }>
  /** Resolves with the server's message. */
  onSave: (values: AuthorizationFormValues) => Promise<unknown>
  onClose: () => void
}) {
  const formId = useId()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<AuthorizationFormValues>({
    resolver: zodResolver(authorizationFormSchema),
    defaultValues:
      authorization === null
        ? newAuthorizationValues(issuers[0]?.value ?? null)
        : toAuthorizationFormValues(authorization),
  })
  const submitting = form.formState.isSubmitting
  // A saved authorization keeps its insurance, offered or not.
  const options =
    authorization === null || issuers.some((issuer) => issuer.value === authorization.coverageId)
      ? issuers
      : [{ value: authorization.coverageId, label: authorization.insuranceName || 'Insurance' }]

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={authorization === null ? 'Add authorization' : 'Edit authorization'}
      {...(authorization === null
        ? { description: 'A payer’s pre-approval for a number of visits or units within a date range.' }
        : {})}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {authorization === null ? 'Add authorization' : 'Save authorization'}
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
            name="coverageId"
            label="Issued by"
            required
            span={12}
            {...(authorization === null
              ? {}
              : { info: 'The insurance that issued a saved authorization cannot be changed.' })}
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={options}
                placeholder="Select the insurance"
                disabled={authorization !== null || submitting}
              />
            )}
          </FormField>
          <FormField
            name="number"
            label="Authorization number"
            required
            span={12}
            info="Once per insurance: the same number cannot be on the insurance twice."
          >
            {(field) => (
              <Input
                {...field}
                value={typeof field.value === 'string' ? field.value : ''}
                placeholder="Enter authorization number"
                autoComplete="off"
                maxLength={AUTH_NUMBER_MAX}
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="start" label="Start date" required span={6}>
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField name="end" label="End date" required span={6}>
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField name="qty" label="Approved" required span={6}>
            {(field) => (
              <Input
                {...field}
                value={typeof field.value === 'string' ? field.value : ''}
                type="number"
                inputMode="numeric"
                min={1}
                max={AUTH_QTY_MAX}
                step={1}
                placeholder="Enter number approved"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="unit" label="Unit" required span={6}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => {
                  const unit = AUTH_UNITS.find((option) => option.value === next)
                  if (unit !== undefined) field.onChange(unit.value)
                }}
                options={AUTH_UNITS}
                disabled={submitting}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import type { ProcedureCode } from '@/features/admin-procedure-codes'
import { useCreateFeeRow, useFeeRow, useUpdateFeeRow } from '../queries/use-fee-schedules'
import type { FeeRow } from '../schemas/fee-row'
import {
  feeRowFormSchema,
  newFeeRowValues,
  toFeeRowFormValues,
  type FeeRowFormValues,
} from '../schemas/fee-row-form'

/**
 * Add or edit one fee row of an insurance, as in the prototype: the code, the
 * billed price per unit, and the dates it is in effect — the end date may be
 * left empty for a price with no end.
 *
 * Editing starts from the row as the server has it now
 * (`GET /fee-schedules/{id}`; Save waits for it). The code is fixed once the
 * row exists: the server refuses a save that carries one. A new row offers the
 * active codes; the server says when the dates overlap another price of the
 * same code for this insurance.
 */
export function FeeRowDialog({
  insuranceId,
  insuranceName,
  row,
  codes,
  onClose,
}: {
  insuranceId: number
  insuranceName: string
  /** `null` adds a new row. */
  row: FeeRow | null
  codes: readonly ProcedureCode[]
  onClose: () => void
}) {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const current = useFeeRow(row?.id ?? null)
  const ready = row === null || current.isSuccess

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={row ? 'Edit fee row' : 'Add fee row'}
      description={insuranceName}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            Save fee row
          </Button>
        </>
      }
    >
      {row === null ? (
        <FeeRowForm
          formId={formId}
          insuranceId={insuranceId}
          row={null}
          codes={codes}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isSuccess ? (
        <FeeRowForm
          formId={formId}
          insuranceId={insuranceId}
          row={current.data}
          codes={codes}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This fee row no longer exists"
            description="It may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={2} columns={2} />
      )}
    </Dialog>
  )
}

function FeeRowForm({
  formId,
  insuranceId,
  row,
  codes,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  insuranceId: number
  /** `null` adds a new row. */
  row: FeeRow | null
  codes: readonly ProcedureCode[]
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateFeeRow()
  const update = useUpdateFeeRow()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<FeeRowFormValues>({
    resolver: zodResolver(feeRowFormSchema),
    defaultValues: row ? toFeeRowFormValues(row) : newFeeRowValues(),
  })
  const submitting = form.formState.isSubmitting
  // A saved row shows its own code, whatever the list holds; a new one picks an active code.
  const options =
    row === null
      ? codes
          .filter((code) => code.isActive)
          .map((code) => ({ value: String(code.id), label: `${code.code} — ${code.description}` }))
      : [{ value: String(row.procedureCodeId), label: `${row.procedureCode} — ${row.description}` }]

  const onSubmit = async (values: FeeRowFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    try {
      const message = row
        ? await update.mutateAsync({ id: row.id, values })
        : await create.mutateAsync({ insuranceId, values })
      // The server's words; ours only when it sent none.
      toast.success(message ?? 'Fee row saved')
      onDone()
    } catch (error) {
      // An overlap comes back as a message without field errors: it shows above the form.
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    } finally {
      onSubmittingChange(false)
    }
  }

  return (
    <Form id={formId} form={form} onSubmit={onSubmit}>
      <FormGrid>
        {failure !== null && (
          <div className="col-span-12">
            <Notice tone="critical">{failure}</Notice>
          </div>
        )}
        <FormField
          name="procedureCodeId"
          label="Code"
          required
          span={8}
          {...(row ? { info: 'The code of a saved row cannot be changed.' } : {})}
        >
          {(field) => (
            <SearchSelect
              value={typeof field.value === 'string' ? field.value : null}
              onChange={field.onChange}
              options={options}
              placeholder="Select a code"
              searchPlaceholder="Search codes"
              emptyMessage="No active procedure codes."
              disabled={row !== null || submitting}
            />
          )}
        </FormField>
        <FormField name="billed" label="Billed per unit" required span={4} info="Put on the claim.">
          {(field) => (
            <Input
              {...field}
              // Takes only what an amount can hold, as the prototype's money field does.
              onChange={(event) =>
                field.onChange(event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))
              }
              prefix="$"
              placeholder="Enter billed price"
              inputMode="decimal"
              autoComplete="off"
              readOnly={submitting}
            />
          )}
        </FormField>
        <FormField name="from" label="Effective from" required span={6}>
          {(field) => (
            <DateInput
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField
          name="to"
          label="Effective to"
          span={6}
          info="Leave it empty for a price with no end date."
        >
          {(field) => (
            <DateInput
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={submitting}
            />
          )}
        </FormField>
      </FormGrid>
    </Form>
  )
}

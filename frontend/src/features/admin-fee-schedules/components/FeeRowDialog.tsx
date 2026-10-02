import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import type { ProcedureCode } from '@/features/admin-procedure-codes'
import type { FeeRow } from '../model/fee-row'
import {
  feeRowFormSchema,
  newFeeRowValues,
  toFeeRow,
  toFeeRowFormValues,
  type FeeRowFormValues,
} from '../schemas/fee-row-form'

/**
 * Add or edit one fee row of an insurance, as in the prototype: the code, the
 * billed price per unit, and the dates it is in effect. The code is fixed once
 * the row exists; a new row offers only codes the insurance has no row for.
 *
 * Saving updates the list in this tab only — there is no backend (see
 * `data/fee-schedule-store.ts`).
 */
export function FeeRowDialog({
  insuranceId,
  insuranceName,
  row,
  codes,
  takenCodes,
  onSave,
  onClose,
}: {
  insuranceId: number
  insuranceName: string
  /** `null` adds a new row. */
  row: FeeRow | null
  codes: readonly ProcedureCode[]
  /** Codes this insurance already has a row for. */
  takenCodes: readonly string[]
  onSave: (row: FeeRow) => void
  onClose: () => void
}) {
  const formId = useId()
  const form = useForm<FeeRowFormValues>({
    resolver: zodResolver(feeRowFormSchema),
    defaultValues: row ? toFeeRowFormValues(row) : newFeeRowValues(),
  })
  const options = codes
    .filter((code) => row !== null || !takenCodes.includes(code.code))
    .map((code) => ({ value: code.code, label: `${code.code} — ${code.description}` }))

  const onSubmit = (values: FeeRowFormValues) => {
    onSave(toFeeRow(insuranceId, values))
    toast.success('Fee row saved')
    onClose()
  }

  const dateField = (name: 'from' | 'to', label: string) => (
    <FormField name={name} label={label} required span={6}>
      {(field) => (
        <DateInput
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />
      )}
    </FormField>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={row ? 'Edit fee row' : 'Add fee row'}
      description={insuranceName}
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Save fee row
          </Button>
        </>
      }
    >
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
          <FormField
            name="procedureCode"
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
                emptyMessage="Every code already has a row for this insurance."
                disabled={row !== null}
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
              />
            )}
          </FormField>
          {dateField('from', 'Effective from')}
          {dateField('to', 'Effective to')}
        </FormGrid>
      </Form>
    </Dialog>
  )
}

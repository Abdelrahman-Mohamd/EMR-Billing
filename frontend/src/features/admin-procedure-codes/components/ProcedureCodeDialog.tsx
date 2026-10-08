import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { Switch } from '@/components/ui/Switch'
import { MODIFIER_SLOTS, procedureTypeOptions } from '../model/procedure-code'
import {
  useCreateProcedureCode,
  useProcedureCode,
  useUpdateProcedureCode,
} from '../queries/use-procedure-codes'
import type { ProcedureCode } from '../schemas/procedure-code'
import {
  newProcedureCodeValues,
  procedureCodeFormSchema,
  toProcedureCodeFormValues,
  type ProcedureCodeFormValues,
} from '../schemas/procedure-code-form'

const SLOTS = Array.from({ length: MODIFIER_SLOTS }, (_, index) => index)

/**
 * Add or edit a procedure code, in the prototype's layout: code and
 * description; default fee and procedure type; Timed and Active; then the
 * Modifiers section, where **Modifier override** is off by default and, once
 * switched on, shows its warning and four modifier inputs (client,
 * 2026-09-30).
 *
 * Editing starts from the code as the server has it now
 * (`GET /procedure-codes/{id}`; Save waits for it). The code itself can be
 * changed, as the server allows (user decision 2026-10-08).
 */
export function ProcedureCodeDialog({
  procedureCode,
  onClose,
}: {
  /** `null` adds a new code. */
  procedureCode: ProcedureCode | null
  onClose: () => void
}) {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const current = useProcedureCode(procedureCode?.id ?? null)
  const ready = procedureCode === null || current.isSuccess

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={procedureCode ? `${procedureCode.code} — ${procedureCode.description}` : 'New procedure code'}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            Save code
          </Button>
        </>
      }
    >
      {procedureCode === null ? (
        <ProcedureCodeForm
          formId={formId}
          procedureCode={null}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isSuccess ? (
        <ProcedureCodeForm
          formId={formId}
          procedureCode={current.data}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This code no longer exists"
            description="It may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={4} columns={2} />
      )}
    </Dialog>
  )
}

function ProcedureCodeForm({
  formId,
  procedureCode,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  /** `null` adds a new code. */
  procedureCode: ProcedureCode | null
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateProcedureCode()
  const update = useUpdateProcedureCode()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ProcedureCodeFormValues>({
    resolver: zodResolver(procedureCodeFormSchema),
    defaultValues: procedureCode ? toProcedureCodeFormValues(procedureCode) : newProcedureCodeValues(),
  })
  const submitting = form.formState.isSubmitting
  const override = useWatch({ control: form.control, name: 'modifierOverride' })

  const onSubmit = async (values: ProcedureCodeFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    try {
      const message = procedureCode
        ? await update.mutateAsync({ id: procedureCode.id, values })
        : await create.mutateAsync(values)
      // The server's words; ours only when it sent none.
      toast.success(message ?? 'Code saved')
      onDone()
    } catch (error) {
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    } finally {
      onSubmittingChange(false)
    }
  }

  const switchField = (
    name: 'isTimed' | 'isActive' | 'modifierOverride',
    label: string,
    /** What the switch does, behind the info icon beside its label. */
    info?: string,
  ) => (
    <FormField name={name}>
      {(field) => (
        <Switch
          label={label}
          {...(info === undefined ? {} : { info })}
          name={field.name}
          checked={field.value === true}
          onCheckedChange={field.onChange}
          onBlur={field.onBlur}
          disabled={submitting}
        />
      )}
    </FormField>
  )

  return (
    <Form id={formId} form={form} onSubmit={onSubmit}>
      <FormGrid>
        {failure !== null && (
          <div className="col-span-12">
            <Notice tone="critical">{failure}</Notice>
          </div>
        )}
        <FormField
          name="code"
          label="CPT / HCPCS"
          required
          span={4}
          info="A CPT code (97110, 0001F) or an HCPCS code (E0114). No two codes can be the same."
        >
          {(field) => (
            <Input
              {...field}
              // Shown as it will be saved: in capitals.
              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={5}
              autoCapitalize="characters"
              autoComplete="off"
              readOnly={submitting}
            />
          )}
        </FormField>
        <FormField name="description" label="Description" required span={8}>
          {(field) => (
            <Input {...field} placeholder="Enter description" autoComplete="off" readOnly={submitting} />
          )}
        </FormField>
        <FormField
          name="defaultFee"
          label="Default fee per unit"
          span={6}
          info="Left empty, the fee is $0.00."
        >
          {(field) => (
            <Input
              {...field}
              // Takes only what an amount can hold, as the prototype's money field does.
              onChange={(event) =>
                field.onChange(event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))
              }
              prefix="$"
              placeholder="Enter default fee"
              inputMode="decimal"
              autoComplete="off"
              readOnly={submitting}
            />
          )}
        </FormField>
        <FormField name="procedureType" label="Procedure type" required span={6}>
          {(field) => {
            const value = typeof field.value === 'string' ? field.value : null
            return (
              <Select
                value={value}
                onChange={field.onChange}
                options={procedureTypeOptions(value, procedureCode?.procedureTypeLabel)}
                placeholder="Select a type"
                disabled={submitting}
              />
            )
          }}
        </FormField>
        {switchField('isTimed', 'Timed — units follow the 8-minute rule')}
        {switchField('isActive', 'Active', 'Inactive codes cannot be added to new charge lines.')}

        <FormSection title="Modifiers">
          {switchField(
            'modifierOverride',
            'Modifier override',
            'Off: charge lines keep the modifiers they arrive with.',
          )}
          {override && (
            <>
              <div className="col-span-12">
                <Notice tone="info">
                  These modifiers will override any modifiers provided from other sources.
                </Notice>
              </div>
              {SLOTS.map((index) => (
                <FormField
                  key={index}
                  name={`modifiers.${index}`}
                  label={`Modifier ${index + 1}`}
                  required={index === 0}
                  span={3}
                >
                  {(field) => (
                    <Input
                      {...field}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      placeholder="Enter modifier"
                      maxLength={2}
                      autoCapitalize="characters"
                      autoComplete="off"
                      readOnly={submitting}
                    />
                  )}
                </FormField>
              ))}
            </>
          )}
        </FormSection>
      </FormGrid>
    </Form>
  )
}

import { useId, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { MODIFIER_SLOTS, PROCEDURE_TYPES, type ProcedureCode } from '../model/procedure-code'
import {
  newProcedureCodeValues,
  procedureCodeFormSchema,
  toProcedureCode,
  toProcedureCodeFormValues,
  type ProcedureCodeFormValues,
} from '../schemas/procedure-code-form'

const TYPE_OPTIONS = PROCEDURE_TYPES.map((type) => ({ value: type, label: type }))
const SLOTS = Array.from({ length: MODIFIER_SLOTS }, (_, index) => index)

/**
 * Add or edit a procedure code, in the prototype's layout: code and
 * description; default fee and procedure type; Timed and Active; then the
 * Modifiers section, where **Modifier override** is off by default and, once
 * switched on, shows its warning and four optional modifier inputs
 * (client, 2026-09-30).
 *
 * The code is fixed once saved, as in the prototype. Saving updates the list
 * in this tab only — there is no backend (see `data/procedure-code-store.ts`).
 */
export function ProcedureCodeDialog({
  procedureCode,
  existingCodes,
  onSave,
  onClose,
}: {
  /** `null` adds a new code. */
  procedureCode: ProcedureCode | null
  /** Codes already in the list, so a new one cannot repeat them. */
  existingCodes: readonly string[]
  onSave: (code: ProcedureCode) => void
  onClose: () => void
}) {
  const formId = useId()
  const schema = useMemo(
    () => procedureCodeFormSchema(procedureCode === null ? existingCodes : null),
    [procedureCode, existingCodes],
  )
  const form = useForm<ProcedureCodeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: procedureCode ? toProcedureCodeFormValues(procedureCode) : newProcedureCodeValues(),
  })
  const override = useWatch({ control: form.control, name: 'modifierOverride' })

  const onSubmit = (values: ProcedureCodeFormValues) => {
    onSave(toProcedureCode(values))
    toast.success('Code saved')
    onClose()
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
      title={procedureCode ? `${procedureCode.code} — ${procedureCode.description}` : 'New procedure code'}
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Save code
          </Button>
        </>
      }
    >
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
          <FormField
            name="code"
            label="CPT / HCPCS"
            required
            span={4}
            {...(procedureCode ? { info: 'A saved code cannot be changed.' } : {})}
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
                readOnly={procedureCode !== null}
              />
            )}
          </FormField>
          <FormField name="description" label="Description" required span={8}>
            {(field) => <Input {...field} placeholder="Enter description" autoComplete="off" />}
          </FormField>
          <FormField name="defaultFee" label="Default fee per unit" required span={6}>
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
              />
            )}
          </FormField>
          <FormField name="procedureType" label="Procedure type" required span={6}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={TYPE_OPTIONS}
                placeholder="Select a type"
              />
            )}
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
                  <FormField key={index} name={`modifiers.${index}`} label={`Modifier ${index + 1}`} span={3}>
                    {(field) => (
                      <Input
                        {...field}
                        onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                        placeholder="Optional"
                        maxLength={2}
                        autoCapitalize="characters"
                        autoComplete="off"
                      />
                    )}
                  </FormField>
                ))}
              </>
            )}
          </FormSection>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

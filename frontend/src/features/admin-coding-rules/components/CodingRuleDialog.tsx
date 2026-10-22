import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { RULE_TYPES, type CodingRule, type RuleType } from '../model/coding-rule'
import {
  NOTE_MAX,
  codingRuleFormSchema,
  newCodingRuleValues,
  toCodingRuleFormValues,
  type CodingRuleFormValues,
} from '../schemas/coding-rule-form'

const TYPE_OPTIONS: ReadonlyArray<{ value: RuleType; label: string; description: string }> = [
  { value: 'Replace', label: 'Replace', description: 'Convert a code to an alternative code.' },
  { value: 'Drop', label: 'Drop', description: 'Remove the code from the claim.' },
]

export interface Option {
  value: string
  label: string
}

/**
 * New or edit a coding rule, in the prototype's order: Rule type (a dropdown —
 * Replace / Drop, each with what it does), Code and Replace with side by side,
 * Applies to (one insurance of the practice), and Why.
 *
 * "Replace with" means nothing for a Drop rule: it stays in place, so the form
 * does not jump, but is switched off; whatever it held is not sent. The save
 * waits for the server: its field errors land on the fields (one rule per code
 * by default and per payer, on the code), anything else shows above the form.
 */
export function CodingRuleDialog({
  rule,
  codeOptions,
  scopeOptions,
  onSave,
  onClose,
}: {
  /** `null` adds a new rule. */
  rule: CodingRule | null
  /** Every procedure code by its id, "97014 — Electrical stimulation, unattended". */
  codeOptions: readonly Option[]
  /** Default, and the practice's insurances. */
  scopeOptions: readonly Option[]
  /** Resolves with the server's message. */
  onSave: (values: CodingRuleFormValues) => Promise<unknown>
  onClose: () => void
}) {
  const formId = useId()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<CodingRuleFormValues>({
    resolver: zodResolver(codingRuleFormSchema),
    defaultValues: rule ? toCodingRuleFormValues(rule) : newCodingRuleValues(),
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: CodingRuleFormValues) => {
    setFailure(null)
    try {
      await onSave(values)
      onClose()
    } catch (error) {
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    }
  }

  const codeSelect = (
    value: string | null,
    onChange: (value: string | null) => void,
    placeholder: string,
    disabled = false,
  ) => (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={codeOptions}
      placeholder={placeholder}
      searchPlaceholder="Search codes"
      disabled={disabled || submitting}
    />
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={rule ? 'Edit coding rule' : 'New coding rule'}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            Save rule
          </Button>
        </>
      }
    >
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
          {failure !== null && (
            <div className="col-span-12">
              <Notice tone="critical">{failure}</Notice>
            </div>
          )}
          <FormField name="type" label="Rule type" required span={12}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => {
                  const type = RULE_TYPES.find((option) => option === next)
                  if (type === undefined) return
                  field.onChange(type)
                  // A Drop rule has no replacement to check.
                  if (type === 'Drop') form.clearErrors('toCode')
                }}
                options={TYPE_OPTIONS}
                placeholder="Select a rule type"
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField name="fromCode" label="Code" required span={6}>
            {(field) =>
              codeSelect(
                typeof field.value === 'string' ? field.value : null,
                field.onChange,
                'Select a code',
              )
            }
          </FormField>
          <FormField
            name="toCode"
            label="Replace with"
            required={type === 'Replace'}
            span={6}
            disabled={type === 'Drop'}
          >
            {(field) =>
              codeSelect(
                typeof field.value === 'string' ? field.value : null,
                field.onChange,
                type === 'Drop' ? 'Not used by a Drop rule' : 'Select a code',
                type === 'Drop',
              )
            }
          </FormField>
          <FormField
            name="scope"
            label="Applies to"
            required
            span={12}
            info="Each rule belongs to one insurance of the practice."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => field.onChange(next ?? '')}
                options={scopeOptions}
                placeholder="Select the insurance"
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField name="note" label="Why" span={12}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter a reason"
                autoComplete="off"
                maxLength={NOTE_MAX}
                readOnly={submitting}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

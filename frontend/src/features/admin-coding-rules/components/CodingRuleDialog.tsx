import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import type { CodingRuleValues } from '../data/coding-rule-store'
import { RULE_TYPES, type CodingRule, type RuleType } from '../model/coding-rule'
import {
  codingRuleFormSchema,
  newCodingRuleValues,
  toCodingRuleFormValues,
  toCodingRuleValues,
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
 * Replace / Drop, each with what it does), Code and Replace with side by side, Applies to
 * (the default, a class, or one insurance — with the precedence under it), and
 * Why.
 *
 * "Replace with" means nothing for a Drop rule: it stays in place, so the form
 * does not jump, but is switched off; whatever it held is not kept.
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
  /** Every procedure code, "97014 — Electrical stimulation, unattended". */
  codeOptions: readonly Option[]
  /** Default, the practice's classes and insurances. */
  scopeOptions: readonly Option[]
  onSave: (values: CodingRuleValues) => void
  onClose: () => void
}) {
  const formId = useId()
  const form = useForm<CodingRuleFormValues>({
    resolver: zodResolver(codingRuleFormSchema),
    defaultValues: rule ? toCodingRuleFormValues(rule) : newCodingRuleValues(),
  })
  const type = useWatch({ control: form.control, name: 'type' })

  const onSubmit = (values: CodingRuleFormValues) => {
    onSave(toCodingRuleValues(values))
    toast.success('Rule saved', 'It runs on the next scrub.')
    onClose()
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
      disabled={disabled}
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
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Save rule
          </Button>
        </>
      }
    >
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
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
            info="A payer rule wins over its class rule, and a class rule wins over the default."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => field.onChange(next ?? '')}
                options={scopeOptions}
                placeholder="Select what it applies to"
              />
            )}
          </FormField>
          <FormField name="note" label="Why" span={12}>
            {(field) => <Input {...field} placeholder="Enter a reason (optional)" autoComplete="off" />}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { SearchSelect } from '@/components/ui/SearchSelect'
import type { Icd10Code } from '../../data/patient-records-store'
import { MAX_DIAGNOSES } from '../../model/case'

const schema = z.object({
  code: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select an ICD-10 code.'),
})
type Values = z.infer<typeof schema>

/**
 * The prototype's "Add diagnosis": one ICD-10 code, from those not already on
 * the case. It takes the next pointer.
 */
export function DiagnosisDialog({
  pointer,
  codes,
  onAdd,
  onClose,
}: {
  /** The position it will take, 1–12. */
  pointer: number
  /** The ICD-10 codes the case does not hold yet. */
  codes: readonly Icd10Code[]
  onAdd: (code: Icd10Code) => void
  onClose: () => void
}) {
  const formId = useId()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: null } })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Add diagnosis"
      description={`Pointer ${pointer} of ${MAX_DIAGNOSES}.`}
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Add diagnosis
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          const chosen = codes.find((code) => code.code === values.code)
          if (chosen !== undefined) onAdd(chosen)
          onClose()
        }}
      >
        <FormGrid>
          <FormField name="code" label="ICD-10 code" required span={12}>
            {(field) => (
              <SearchSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={codes.map((code) => ({
                  value: code.code,
                  label: `${code.code} — ${code.description}`,
                }))}
                placeholder="Select an ICD-10 code"
                searchPlaceholder="Search codes or descriptions"
                emptyMessage="No ICD-10 codes to choose from."
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

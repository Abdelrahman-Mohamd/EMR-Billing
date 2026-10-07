import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { KeyValue } from '@/components/ui/KeyValue'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import {
  chargeLineFields,
  lineCode,
  modifiersText,
  pointersText,
  useVisitReferences,
  type Visit,
} from '@/features/visits'
import { userMessage } from '@/lib/api/api-error'
import { formatIsoDate } from '@/lib/utils/dates'
import { useCreateClaim } from '../queries/use-claims'

const schema = z.object({
  lineId: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select a charge line.'),
})
type Values = z.infer<typeof schema>

/**
 * Create a claim from one of the visit's charge lines: the claim payload is
 * the visit and that line's procedure code, units, modifiers and diagnosis
 * pointers, copied as they are and shown before creating.
 */
export function CreateClaimDialog({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const formId = useId()
  const refs = useVisitReferences()
  const create = useCreateClaim()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { lineId: visit.chargeLines.length === 1 ? String(visit.chargeLines[0]?.id) : null },
  })
  const lineId = useWatch({ control: form.control, name: 'lineId' })
  const line = visit.chargeLines.find((item) => String(item.id) === lineId)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Create claim"
      description={`${refs.patientFullName(visit.caseId)} · ${formatIsoDate(visit.dateOfService)}`}
      size="md"
      dismissible={!create.isPending}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
            Create claim
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async () => {
          if (line === undefined) return
          setFailure(null)
          try {
            await create.mutateAsync({ visit_id: visit.id, ...chargeLineFields(line) })
            toast.success('Claim created')
            onClose()
          } catch (error) {
            setFailure(userMessage(error))
          }
        }}
      >
        <FormGrid>
          <FormField
            name="lineId"
            label="Charge line"
            required
            span={12}
            info="The claim takes this line’s procedure code, units, modifiers and diagnosis pointers."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={visit.chargeLines.map((item) => ({
                  value: String(item.id),
                  label: [lineCode(item), modifiersText(item)].filter(Boolean).join(' · '),
                }))}
                placeholder="Select a charge line"
              />
            )}
          </FormField>
        </FormGrid>
        {line !== undefined && (
          <KeyValue
            className="mt-2"
            items={[
              {
                label: 'Procedure',
                value: [
                  refs.procedure(line.procedureCode).code,
                  refs.procedure(line.procedureCode).description,
                ]
                  .filter(Boolean)
                  .join(' — '),
              },
              { label: 'Units', value: String(line.units) },
              { label: 'Modifiers', value: modifiersText(line) },
              { label: 'Diagnosis pointers', value: pointersText(line, visit.caseId, refs) },
            ]}
          />
        )}
        {failure !== null && (
          <Notice tone="critical" className="mt-4">
            {failure}
          </Notice>
        )}
      </Form>
    </Dialog>
  )
}

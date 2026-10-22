import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import type { Coverage } from '@/features/patients'
import type { Visit } from '@/features/visits'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { formatIsoDate } from '@/lib/utils/dates'
import { formatMoney } from '@/lib/utils/money'
import { useCreateClaim } from '../queries/use-claims'
import { CLAIM_FORMATS } from '../schemas/claim'

const schema = z.object({
  coverageId: z
    .string()
    .nullable()
    .refine((value): boolean => value !== null, 'Select the insurance to bill.'),
  format: z.string(),
})
type Values = z.infer<typeof schema>

/**
 * Bill a released visit: the server makes one claim for the whole visit — all
 * its charge lines — to one of the case's insurances, in a format (837P, the
 * server's own default, or CMS-1500) — the payload's fields, and only those.
 * Offered: the case's insurances not billed for this visit yet, the highest
 * priority chosen. The
 * server says when one may not be billed yet (the secondary before the
 * primary's claim is paid or denied); its message shows above the form.
 */
export function CreateClaimDialog({
  visit,
  coverages,
  onClose,
}: {
  visit: Visit
  /** The case's insurances without a claim for this visit, in the server's order. */
  coverages: readonly Coverage[]
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateClaim()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    // The highest priority not billed yet (the lowest rank) is the one offered first.
    defaultValues: {
      coverageId:
        coverages.reduce<Coverage | undefined>(
          (best, item) => (best === undefined || item.rank < best.rank ? item : best),
          undefined,
        )?.id ?? null,
      format: '837P',
    },
  })
  const total = Number(visit.totalAmount)
  const lines = visit.chargeLines.length

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Create claim"
      description={`The visit on ${formatIsoDate(visit.dateOfService)} — ${lines === 1 ? 'its charge line' : `all ${lines} of its charge lines`}${visit.totalAmount === '' || Number.isNaN(total) ? '' : `, ${formatMoney(total)}`}.`}
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
        onSubmit={async (values) => {
          setFailure(null)
          try {
            const message = await create.mutateAsync({
              visit_id: visit.id,
              case_insurance_id: Number(values.coverageId),
              format: values.format,
            })
            toast.success(message ?? 'Claim created')
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
            label="Bill to"
            required
            span={12}
            info="A visit has one claim per insurance. The secondary is billed once the primary’s claim is paid or denied."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={coverages.map((coverage) => ({
                  value: coverage.id,
                  label: `${coverage.insuranceLabel || coverage.insuranceName || 'Insurance'}${coverage.rankLabel === '' ? '' : ` (${coverage.rankLabel.toLowerCase()})`}`,
                }))}
                placeholder="Select the insurance"
                disabled={create.isPending}
              />
            )}
          </FormField>
          <FormField
            name="format"
            label="Format"
            required
            span={12}
            info="It can be changed until the claim is sent."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => field.onChange(next ?? '837P')}
                options={CLAIM_FORMATS}
                placeholder="Select the format"
                disabled={create.isPending}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

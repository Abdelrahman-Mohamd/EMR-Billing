import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { useUpdateClaim } from '../queries/use-claims'
import {
  CLAIM_FORMATS,
  CLEARINGHOUSE_REF_MAX,
  claimStatus,
  type Claim,
  type UpdateClaimPayload,
} from '../schemas/claim'

const schema = z.object({
  status: z.string(),
  format: z.string(),
  clearinghouseRef: z
    .string()
    .trim()
    .max(CLEARINGHOUSE_REF_MAX, `Use at most ${CLEARINGHOUSE_REF_MAX} characters.`),
})
type Values = z.infer<typeof schema>

/**
 * Move a claim on, or correct it: its status — to where the server allows
 * next (held → scrubbed → sent → paid, denied or rejected; never back) — its
 * format (fixed once sent) and the clearinghouse's reference. Only what
 * changed is sent; the server's refusals show above the form.
 */
export function EditClaimDialog({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const formId = useId()
  const update = useUpdateClaim()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { status: claim.status, format: claim.format, clearinghouseRef: claim.clearinghouseRef },
  })
  const sent = claim.sentDate !== ''
  const statuses = [claim.status, ...claim.allowedStatusChanges].map((value) => ({
    value,
    label: value === claim.status ? `${claimStatus(value).label} (now)` : claimStatus(value).label,
  }))

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Edit claim"
      description={`${claim.insuranceName}${claim.rankLabel === '' ? '' : ` · ${claim.rankLabel}`}`}
      size="md"
      dismissible={!update.isPending}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={update.isPending}>
            Save claim
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          const payload: UpdateClaimPayload = {
            ...(values.status === claim.status ? {} : { status: values.status }),
            ...(values.format === claim.format ? {} : { format: values.format }),
            ...(values.clearinghouseRef === claim.clearinghouseRef
              ? {}
              : { clearinghouse_ref: values.clearinghouseRef === '' ? null : values.clearinghouseRef }),
          }
          if (Object.keys(payload).length === 0) {
            onClose()
            return
          }
          try {
            const message = await update.mutateAsync({ id: claim.id, payload })
            toast.success(message ?? 'Claim saved')
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
            name="status"
            label="Status"
            required
            span={6}
            info="Where the claim can go next: held → scrubbed → sent → paid, denied or rejected. It never goes back."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => {
                  if (next !== null) field.onChange(next)
                }}
                options={statuses}
                disabled={claim.allowedStatusChanges.length === 0 || update.isPending}
              />
            )}
          </FormField>
          <FormField
            name="format"
            label="Format"
            required
            span={6}
            {...(sent ? { info: 'The format of a claim that was sent cannot change.' } : {})}
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => {
                  if (next !== null) field.onChange(next)
                }}
                options={CLAIM_FORMATS.map((item) => ({ value: item.value, label: item.label }))}
                disabled={sent || update.isPending}
              />
            )}
          </FormField>
          <FormField name="clearinghouseRef" label="Clearinghouse reference" span={12}>
            {(field) => (
              <Input
                {...field}
                value={typeof field.value === 'string' ? field.value : ''}
                placeholder="Enter the clearinghouse’s reference"
                autoComplete="off"
                maxLength={CLEARINGHOUSE_REF_MAX}
                readOnly={update.isPending}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

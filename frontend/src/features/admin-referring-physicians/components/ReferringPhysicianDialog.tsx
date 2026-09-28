import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { PracticeSelect } from '@/features/admin-practices'
import { DEFAULT_PHYSICIAN_TYPE, physicianTypeOptions } from '../model/physician-type'
import { useCreateReferringPhysician, useUpdateReferringPhysician } from '../queries/use-referring-physicians'
import {
  referringPhysicianFormSchema,
  type ReferringPhysician,
  type ReferringPhysicianFormValues,
} from '../schemas/referring-physician'

/**
 * Add or edit a referring physician, in the prototype's layout (name, type,
 * NPI) with the payload's practice and code added and the prototype's phone,
 * fax and practice-name fields left out — the payload has none of them.
 *
 * The practice is chosen when the physician is added. On edit it is shown but
 * cannot be changed: whether a physician may move to another practice, and
 * what that would do to cases already using them, is not defined.
 */
export function ReferringPhysicianDialog({
  physician,
  defaultPracticeId,
  onClose,
}: {
  /** `null` adds a new physician. */
  physician: ReferringPhysician | null
  /** Pre-selects the practice the list is filtered to, if any. */
  defaultPracticeId: string | null
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateReferringPhysician()
  const update = useUpdateReferringPhysician()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ReferringPhysicianFormValues>({
    resolver: zodResolver(referringPhysicianFormSchema),
    defaultValues: physician
      ? {
          practiceId: String(physician.practiceId),
          code: physician.code,
          name: physician.name,
          type: physician.type,
          npi: physician.npi,
        }
      : { practiceId: defaultPracticeId, code: '', name: '', type: DEFAULT_PHYSICIAN_TYPE, npi: '' },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: ReferringPhysicianFormValues) => {
    setFailure(null)
    try {
      if (physician) await update.mutateAsync({ id: physician.id, values })
      else await create.mutateAsync(values)
      toast.success('Physician saved')
      onClose()
    } catch (error) {
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={physician ? physician.name : 'New referring physician'}
      description={
        physician
          ? "Update this physician's details."
          : 'Add a referring or supervising physician to one of your practices.'
      }
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            Save physician
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
          <FormField
            name="practiceId"
            label="Practice"
            required
            {...(physician
              ? { info: 'The practice whose cases use this physician. It cannot be changed here.' }
              : {})}
          >
            {(field) => (
              <PracticeSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                disabled={submitting || physician !== null}
              />
            )}
          </FormField>
          <FormField name="name" label="Name" required span={8}>
            {(field) => (
              <Input {...field} placeholder="Enter physician name" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField
            name="code"
            label="Code"
            required
            span={4}
            // V2: `referring_physician.code` is unique within its practice.
            info="A short code that identifies the physician. No two physicians of a practice can share one."
          >
            {(field) => (
              <Input {...field} placeholder="Enter physician code" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField
            name="type"
            label="Type"
            required
            span={6}
            info="Sets the qualifier printed in Box 17 of the claim: DN for a referring physician, DQ for a supervising one."
          >
            {(field) => {
              const current = typeof field.value === 'string' ? field.value : null
              return (
                <Select
                  value={current}
                  onChange={field.onChange}
                  options={physicianTypeOptions(current)}
                  placeholder="Select a type"
                  disabled={submitting}
                />
              )
            }}
          </FormField>
          <FormField
            name="npi"
            label="NPI"
            required
            span={6}
            info="The physician's NPI, printed in Box 17b of the claim."
          >
            {(field) => (
              <Input
                {...field}
                placeholder="Enter NPI"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

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
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { Switch } from '@/components/ui/Switch'
import { PracticeSelect } from '@/features/admin-practices'
import { DEFAULT_PHYSICIAN_TYPE, physicianTypeOptions } from '../model/physician-type'
import {
  useCreateReferringPhysician,
  useReferringPhysician,
  useUpdateReferringPhysician,
} from '../queries/use-referring-physicians'
import {
  referringPhysicianFormSchema,
  toReferringPhysicianFormValues,
  type ReferringPhysician,
  type ReferringPhysicianFormValues,
} from '../schemas/referring-physician'

/**
 * Add or edit a referring physician, in the prototype's layout — name, type,
 * NPI, phone, fax — with the backend's practice, code and Active added. The
 * prototype's free-text "Practice name" is not in the contract.
 *
 * Editing starts from the physician as the server has them now
 * (`GET /referring-physicians/{id}`; Save waits for it). The practice is
 * chosen when the physician is added and shown fixed on edit: the server
 * refuses a save that carries one.
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
  const [submitting, setSubmitting] = useState(false)
  const current = useReferringPhysician(physician?.id ?? null)
  const ready = physician === null || current.isSuccess

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
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            Save physician
          </Button>
        </>
      }
    >
      {physician === null ? (
        <PhysicianForm
          formId={formId}
          physician={null}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isSuccess ? (
        <PhysicianForm
          formId={formId}
          physician={current.data}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This physician no longer exists"
            description="They may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={3} columns={2} />
      )}
    </Dialog>
  )
}

function PhysicianForm({
  formId,
  physician,
  defaultPracticeId,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  /** `null` adds a new physician. */
  physician: ReferringPhysician | null
  defaultPracticeId: string | null
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateReferringPhysician()
  const update = useUpdateReferringPhysician()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ReferringPhysicianFormValues>({
    resolver: zodResolver(referringPhysicianFormSchema),
    defaultValues: physician
      ? toReferringPhysicianFormValues(physician)
      : {
          practiceId: defaultPracticeId,
          code: '',
          name: '',
          type: DEFAULT_PHYSICIAN_TYPE,
          npi: '',
          phone: '',
          fax: '',
          // New physicians start active.
          isActive: true,
        },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: ReferringPhysicianFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    try {
      const message = physician
        ? await update.mutateAsync({ id: physician.id, values })
        : await create.mutateAsync(values)
      // The server's words; ours only when it sent none.
      toast.success(message ?? 'Physician saved')
      onDone()
    } catch (error) {
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    } finally {
      onSubmittingChange(false)
    }
  }

  return (
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
          info="A short code that identifies the physician. No two physicians of a practice can share one."
        >
          {(field) => (
            <Input
              {...field}
              placeholder="Enter physician code"
              maxLength={20}
              autoComplete="off"
              readOnly={submitting}
            />
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
            const value = typeof field.value === 'string' ? field.value : null
            return (
              <Select
                value={value}
                onChange={field.onChange}
                options={physicianTypeOptions(value)}
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
          info="The physician's NPI, printed in Box 17b of the claim. No two physicians of a practice can share one."
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
        <FormField name="phone" label="Phone" span={6}>
          {(field) => (
            <Input
              {...field}
              type="tel"
              placeholder="Enter phone number"
              maxLength={14}
              autoComplete="off"
              readOnly={submitting}
            />
          )}
        </FormField>
        <FormField name="fax" label="Fax" span={6}>
          {(field) => (
            <Input
              {...field}
              type="tel"
              placeholder="Enter fax number"
              maxLength={14}
              autoComplete="off"
              readOnly={submitting}
            />
          )}
        </FormField>
        <FormField name="isActive">
          {(field) => (
            <Switch
              label="Active"
              name={field.name}
              checked={field.value === true}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              disabled={submitting}
            />
          )}
        </FormField>
      </FormGrid>
    </Form>
  )
}

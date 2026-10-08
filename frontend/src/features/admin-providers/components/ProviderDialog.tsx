import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { PracticeSelect } from '@/features/admin-practices'
import { providerName, providerTypeOptions, specialtyOptions } from '../model/provider-options'
import { useCreateProvider, useProvider, useUpdateProvider } from '../queries/use-providers'
import {
  NEW_PROVIDER_VALUES,
  providerFormSchema,
  toProviderFormValues,
  type Provider,
  type ProviderFormValues,
} from '../schemas/provider'

/**
 * Add or edit a provider, in the updated prototype's layout: name and
 * credential; Provider ID, specialty and provider type; NPI, taxonomy and
 * state license; Active. There is no payer enrollment or credentialing section
 * — the client removed it (2026-09-30) — and no claim hold: it is not in the
 * contract.
 *
 * Editing starts from the provider as the server has them now
 * (`GET /providers/{id}`; Save waits for it). The practice is chosen when the
 * provider is added and shown fixed on edit: the server refuses a save that
 * carries one.
 */
export function ProviderDialog({
  provider,
  defaultPracticeId,
  onClose,
}: {
  /** `null` adds a new provider. */
  provider: Provider | null
  /** Pre-selects the practice the list is filtered to, if any. */
  defaultPracticeId: string | null
  onClose: () => void
}) {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const current = useProvider(provider?.id ?? null)
  const ready = provider === null || current.isSuccess

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={provider ? providerName(provider) || 'Provider' : 'New provider'}
      description="Clinicians carry an individual NPI, state license and taxonomy."
      size="lg"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            Save provider
          </Button>
        </>
      }
    >
      {provider === null ? (
        <ProviderForm
          formId={formId}
          provider={null}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isSuccess ? (
        <ProviderForm
          formId={formId}
          provider={current.data}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This provider no longer exists"
            description="They may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={4} columns={3} />
      )}
    </Dialog>
  )
}

function ProviderForm({
  formId,
  provider,
  defaultPracticeId,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  /** `null` adds a new provider. */
  provider: Provider | null
  defaultPracticeId: string | null
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateProvider()
  const update = useUpdateProvider()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: provider
      ? toProviderFormValues(provider)
      : { practiceId: defaultPracticeId, ...NEW_PROVIDER_VALUES },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: ProviderFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    try {
      const message = provider
        ? await update.mutateAsync({ id: provider.id, values })
        : await create.mutateAsync(values)
      // The server's words; ours only when it sent none.
      toast.success(message ?? 'Provider saved')
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
          {...(provider ? { info: 'The practice this provider belongs to. It cannot be changed here.' } : {})}
        >
          {(field) => (
            <PracticeSelect
              value={typeof field.value === 'string' ? field.value : null}
              onChange={field.onChange}
              disabled={submitting || provider !== null}
            />
          )}
        </FormField>

        <FormField name="firstName" label="First name" required span={4}>
          {(field) => (
            <Input {...field} placeholder="Enter first name" autoComplete="off" readOnly={submitting} />
          )}
        </FormField>
        <FormField name="lastName" label="Last name" required span={4}>
          {(field) => (
            <Input {...field} placeholder="Enter last name" autoComplete="off" readOnly={submitting} />
          )}
        </FormField>
        <FormField name="credential" label="Credential" span={4} info="For example PT, DPT or OTR/L.">
          {(field) => (
            <Input {...field} placeholder="Enter credential" autoComplete="off" readOnly={submitting} />
          )}
        </FormField>

        <FormField
          name="code"
          label="Provider ID"
          required
          span={4}
          info="No two providers can share a Provider ID."
        >
          {(field) => (
            <Input {...field} placeholder="Enter provider ID" autoComplete="off" readOnly={submitting} />
          )}
        </FormField>
        <FormField name="specialty" label="Specialty" span={4}>
          {(field) => {
            const value = typeof field.value === 'string' ? field.value : null
            return (
              <Select
                value={value}
                onChange={field.onChange}
                options={specialtyOptions(value)}
                placeholder="Select a specialty"
                clearable
                disabled={submitting}
              />
            )
          }}
        </FormField>
        <FormField
          name="type"
          label="Provider type"
          required
          span={4}
          info="Rendering: claims for this provider are put on hold. Billing: eligible for submission."
        >
          {(field) => {
            const value = typeof field.value === 'string' ? field.value : null
            return (
              <Select
                value={value}
                onChange={field.onChange}
                options={providerTypeOptions(value)}
                placeholder="Select a type"
                disabled={submitting}
              />
            )
          }}
        </FormField>

        <FormField
          name="npi"
          label="Individual NPI"
          required
          span={4}
          info="Printed on the claim. No two providers can share an NPI."
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
        <FormField name="taxonomyCode" label="Taxonomy code" span={4} info="For example 225100000X.">
          {(field) => (
            <Input
              {...field}
              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
              placeholder="Enter taxonomy code"
              maxLength={10}
              autoCapitalize="characters"
              autoComplete="off"
              readOnly={submitting}
            />
          )}
        </FormField>
        <FormField name="stateLicense" label="State license" span={4}>
          {(field) => (
            <Input {...field} placeholder="Enter state license" autoComplete="off" readOnly={submitting} />
          )}
        </FormField>

        <FormSection title="Status">
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
        </FormSection>
      </FormGrid>
    </Form>
  )
}

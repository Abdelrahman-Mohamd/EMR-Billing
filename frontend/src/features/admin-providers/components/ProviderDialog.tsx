import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormNote, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { MultiSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useInsurances } from '@/features/admin-insurances'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { PROVIDER_TYPES, providerName, SPECIALTIES } from '../model/provider-options'
import { useCreateProvider, useUpdateProvider } from '../queries/use-providers'
import {
  NEW_PROVIDER_VALUES,
  providerFormSchema,
  toProviderFormValues,
  type Provider,
  type ProviderFormValues,
} from '../schemas/provider'

const SPECIALTY_OPTIONS = SPECIALTIES.map((specialty) => ({ value: specialty, label: specialty }))
const TYPE_OPTIONS = PROVIDER_TYPES.map((type) => ({
  value: type.value,
  label: type.label,
  description: type.meaning,
}))

/**
 * Add or edit a provider, in the updated prototype's layout: name and
 * credential; Provider ID, specialty and provider type; NPI, taxonomy and
 * state license; the claim hold (from, until, reason, and the locations and
 * payers it covers); Active. There is no payer enrollment or credentialing
 * section — the client removed it (2026-09-30).
 *
 * The practice is chosen when the provider is added and shown fixed when
 * editing: moving a provider between practices is not defined. The hold's
 * locations and payers are the practice's own, so changing the practice while
 * adding clears them.
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
  const create = useCreateProvider()
  const update = useUpdateProvider()
  const practices = usePractices()
  const insurances = useInsurances()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: provider
      ? toProviderFormValues(provider)
      : { practiceId: defaultPracticeId, ...NEW_PROVIDER_VALUES },
  })
  const submitting = form.formState.isSubmitting
  const [practiceId, holdUntil] = useWatch({ control: form.control, name: ['practiceId', 'claimHoldUntil'] })
  const held = holdUntil !== ''

  const locationOptions = (
    practices.data?.find((practice) => String(practice.id) === practiceId)?.locations ?? []
  ).map((location) => ({ value: String(location.id), label: location.name }))
  const insuranceOptions = (insurances.data ?? [])
    .filter((insurance) => String(insurance.practiceId) === practiceId)
    .map((insurance) => ({ value: String(insurance.id), label: insurance.name }))

  const onSubmit = async (values: ProviderFormValues) => {
    setFailure(null)
    try {
      if (provider) await update.mutateAsync({ id: provider.id, values })
      else await create.mutateAsync(values)
      toast.success('Provider saved')
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
      title={provider ? providerName(provider) || 'Provider' : 'New provider'}
      description="Clinicians carry an individual NPI, state license and taxonomy."
      size="lg"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            Save provider
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
            {...(provider
              ? { info: 'The practice this provider belongs to. It cannot be changed here.' }
              : {})}
          >
            {(field) => (
              <PracticeSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(value) => {
                  field.onChange(value)
                  // The hold's locations and payers belong to the practice.
                  form.setValue('claimHoldLocationIds', [])
                  form.setValue('claimHoldInsuranceIds', [])
                }}
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

          <FormField name="code" label="Provider ID" required span={4}>
            {(field) => (
              <Input {...field} placeholder="Enter provider ID" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField name="specialty" label="Specialty" required span={4}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={SPECIALTY_OPTIONS}
                placeholder="Select a specialty"
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField
            name="providerType"
            label="Provider type"
            required
            span={4}
            info="Rendering: claims for this provider are put on hold. Billing: eligible for submission."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={TYPE_OPTIONS}
                placeholder="Select a type"
                disabled={submitting}
              />
            )}
          </FormField>

          <FormField name="npi" label="Individual NPI" required span={4} info="Printed on the claim.">
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
          <FormField name="taxonomyCode" label="Taxonomy code" required span={4}>
            {(field) => (
              <Input
                {...field}
                onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                placeholder="Enter taxonomy code"
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

          <FormSection title="Claim hold">
            <FormNote>
              While the hold is running, this provider’s visits inside the window wait and their unsent claims
              are held — billing and submission both. When the end date passes, they go out normally.
            </FormNote>
            <FormField name="claimHoldFrom" label="Hold from" required={held} span={4}>
              {(field) => (
                <DateInput
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={submitting}
                />
              )}
            </FormField>
            <FormField name="claimHoldUntil" label="Hold until" span={4} info="Clear it to lift the hold.">
              {(field) => (
                <DateInput
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={submitting}
                />
              )}
            </FormField>
            <FormField name="claimHoldReason" label="Reason" required={held} span={4}>
              {(field) => (
                <Input {...field} placeholder="Enter hold reason" autoComplete="off" readOnly={submitting} />
              )}
            </FormField>
            <FormField
              name="claimHoldLocationIds"
              label="Locations the hold covers"
              span={6}
              info="Pick none to cover every location."
            >
              {(field) => (
                <MultiSelect
                  value={Array.isArray(field.value) ? field.value : []}
                  onChange={field.onChange}
                  options={locationOptions}
                  placeholder="Every location"
                  searchPlaceholder="Search locations"
                  emptyMessage={
                    practiceId === null ? 'Select a practice first.' : 'No locations in this practice.'
                  }
                  disabled={submitting}
                />
              )}
            </FormField>
            <FormField
              name="claimHoldInsuranceIds"
              label="Payers the hold covers"
              span={6}
              info="Pick none to cover every payer."
            >
              {(field) => (
                <MultiSelect
                  value={Array.isArray(field.value) ? field.value : []}
                  onChange={field.onChange}
                  options={insuranceOptions}
                  placeholder="Every payer"
                  searchPlaceholder="Search payers"
                  emptyMessage={
                    practiceId === null ? 'Select a practice first.' : 'No insurances in this practice.'
                  }
                  disabled={submitting}
                />
              )}
            </FormField>
          </FormSection>

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
    </Dialog>
  )
}

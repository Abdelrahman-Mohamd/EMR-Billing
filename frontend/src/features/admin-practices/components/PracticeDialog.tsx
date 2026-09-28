import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormNote, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useOrganizations } from '@/features/admin-organizations'
import { DEFAULT_PLACE_OF_SERVICE } from '../model/place-of-service'
import { useCreatePractice, useUpdatePractice } from '../queries/use-practices'
import {
  newPracticeFormSchema,
  practiceFormSchema,
  type NewPracticeFormValues,
  type PracticeFormValues,
} from '../schemas/practice-form'
import type { Practice } from '../schemas/practice'
import { AddressFields } from './AddressFields'
import { LocationFields } from './LocationFields'

/**
 * Create or edit a practice, in the prototype's layout: the billing entity,
 * its billing address and identifiers, the optional organization, and — for a
 * new practice only — its first location, because PRD V2 §1.2 (BR01) requires
 * one from the start. Further locations are added from the practice's section.
 */
export function PracticeDialog({ practice, onClose }: { practice: Practice | null; onClose: () => void }) {
  const formId = useId()
  const navigate = useNavigate()
  const create = useCreatePractice()
  const update = useUpdatePractice()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<PracticeFormValues | NewPracticeFormValues>({
    resolver: zodResolver(practice ? practiceFormSchema : newPracticeFormSchema),
    defaultValues: practice
      ? {
          organizationId: practice.organizationId === null ? null : String(practice.organizationId),
          code: practice.code,
          name: practice.name,
          dbaName: practice.dbaName ?? '',
          npi: practice.npi,
          taxId: practice.taxId,
          taxonomyCode: practice.taxonomyCode,
          address: { ...practice.address, line2: practice.address.line2 ?? '' },
          isActive: practice.isActive,
        }
      : {
          organizationId: null,
          code: '',
          name: '',
          dbaName: '',
          npi: '',
          taxId: '',
          taxonomyCode: '',
          address: { line1: '', line2: '', city: '', state: '', zip: '' },
          isActive: true,
          location: {
            code: '',
            name: '',
            npi: '',
            address: { line1: '', city: '', state: '', zip: '' },
            // PRD V2 §10.2: place of service defaults to 11.
            placeOfService: DEFAULT_PLACE_OF_SERVICE,
          },
        },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: PracticeFormValues | NewPracticeFormValues) => {
    setFailure(null)
    try {
      if (practice) {
        await update.mutateAsync({ id: practice.id, values })
        toast.success('Practice saved')
      } else if ('location' in values) {
        const created = await create.mutateAsync(values)
        toast.success(`${created.name} created`)
        // Open the new practice, so its locations are the ones on screen.
        void navigate({ to: '/admin/practices', search: { practice: created.id } })
      }
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
      title={practice ? `Edit ${practice.name}` : 'New practice'}
      description={
        practice
          ? "Update the practice's billing details."
          : "Enter the practice's billing details and its first location."
      }
      size="lg"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {practice ? 'Save practice' : 'Create practice'}
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
          <FormSection title="Practice (billing entity)">
            <FormField name="name" label="Practice name" required span={8}>
              {(field) => (
                <Input
                  {...field}
                  placeholder="Enter practice name"
                  autoComplete="off"
                  readOnly={submitting}
                />
              )}
            </FormField>
            <FormField name="code" label="Practice code" required span={4}>
              {(field) => (
                <Input
                  {...field}
                  placeholder="Enter practice code"
                  autoComplete="off"
                  readOnly={submitting}
                />
              )}
            </FormField>
            <FormField
              name="dbaName"
              label="DBA name"
              span={6}
              info="The name the practice does business under, if it differs from its practice name."
            >
              {(field) => (
                <Input {...field} placeholder="Enter DBA name" autoComplete="off" readOnly={submitting} />
              )}
            </FormField>
            <OrganizationField disabled={submitting} />
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
          <FormSection title="Billing address">
            <AddressFields prefix="address" line1Label="Street address" withLine2 readOnly={submitting} />
          </FormSection>
          <FormSection title="Identifiers">
            <FormField
              name="taxId"
              label="Tax ID"
              required
              span={4}
              info={
                <>
                  The practice's tax identification number, printed on its claims: an EIN{' '}
                  <span className="whitespace-nowrap">(00-0000000)</span> or an SSN{' '}
                  <span className="whitespace-nowrap">(000-00-0000)</span>.
                </>
              }
            >
              {(field) => (
                <Input {...field} placeholder="Enter tax ID" autoComplete="off" readOnly={submitting} />
              )}
            </FormField>
            <FormField
              name="taxonomyCode"
              label="Taxonomy code"
              required
              span={4}
              info="The practice's provider taxonomy code: ten characters ending in X, such as 225100000X."
            >
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
            <FormField
              name="npi"
              label="Group NPI"
              required
              span={4}
              info="The practice's group NPI, printed on every claim it sends."
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
          </FormSection>
          {!practice && (
            <FormSection title="First location (required)">
              <FormNote>
                A practice needs at least one location when it is created. More can be added afterwards.
              </FormNote>
              <LocationFields nested readOnly={submitting} />
            </FormSection>
          )}
        </FormGrid>
      </Form>
    </Dialog>
  )
}

/**
 * The practice's organization (`organization_id`), chosen from the
 * organizations that exist. Optional, as in the prototype; offered only when
 * there is an organization to choose. Inactive organizations are not offered
 * for a new choice, as in the prototype, but a practice already in one keeps
 * it on screen.
 */
function OrganizationField({ disabled }: { disabled: boolean }) {
  const organizations = useOrganizations()
  return (
    <FormField
      name="organizationId"
      label="Organization"
      span={6}
      info="Groups practices that share an owner, so reports can cover all of them. Optional."
      // A load failure is not optional context: it stays visible.
      {...(organizations.isError
        ? { description: 'Organizations could not be loaded, so this cannot be changed right now.' }
        : {})}
    >
      {(field) => {
        const current = typeof field.value === 'string' ? field.value : null
        const options = (organizations.data ?? [])
          .filter((organization) => organization.isActive || String(organization.id) === current)
          .map((organization) => ({
            value: String(organization.id),
            label: organization.isActive ? organization.name : `${organization.name} (inactive)`,
          }))
        return (
          <Select
            value={current}
            onChange={field.onChange}
            options={options}
            placeholder={organizations.isPending ? 'Loading organizations…' : 'No organization'}
            clearable
            disabled={disabled || !organizations.isSuccess || options.length === 0}
          />
        )
      }}
    </FormField>
  )
}

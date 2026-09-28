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
import { Switch } from '@/components/ui/Switch'
import { useCreateOrganization, useUpdateOrganization } from '../queries/use-organizations'
import {
  organizationFormSchema,
  type Organization,
  type OrganizationFormValues,
} from '../schemas/organization'

/**
 * Create or edit one organization. Mounted only while open, and keyed by the
 * organization, so the form always starts from the record being edited — no
 * effect copying props into form state.
 */
export function OrganizationDialog({
  organization,
  onClose,
}: {
  /** `null` creates a new organization. */
  organization: Organization | null
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateOrganization()
  const update = useUpdateOrganization()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: organization
      ? { name: organization.name, isActive: organization.isActive }
      : // New organizations start active, as in the prototype.
        { name: '', isActive: true },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: OrganizationFormValues) => {
    setFailure(null)
    try {
      const saved = organization
        ? await update.mutateAsync({ id: organization.id, input: values })
        : await create.mutateAsync(values)
      toast.success(organization ? 'Organization saved' : `${saved.name} created`)
      onClose()
    } catch (error) {
      // Field errors (a duplicate name) go back on their field; anything else
      // is one message at the top, in words a user can act on.
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
      title={organization ? organization.name : 'New organization'}
      description={
        organization
          ? "Update the organization's name or status."
          : 'Name the organization that groups practices sharing an owner.'
      }
      size="md"
      // Nothing may close it mid-save and leave the outcome unknown.
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {organization ? 'Save organization' : 'Create organization'}
          </Button>
        </>
      }
    >
      {/* The footer's submit button reaches this form through `id`. */}
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
          {failure !== null && (
            <div className="col-span-12">
              <Notice tone="critical">{failure}</Notice>
            </div>
          )}
          <FormField name="name" label="Organization name" required>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter the organization name"
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
    </Dialog>
  )
}

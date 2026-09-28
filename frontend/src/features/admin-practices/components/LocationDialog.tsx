import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Notice } from '@/components/ui/Notice'
import { Switch } from '@/components/ui/Switch'
import { locationToFormValues } from '../model/location-values'
import { DEFAULT_PLACE_OF_SERVICE } from '../model/place-of-service'
import { useCreateLocation, useUpdateLocation } from '../queries/use-practices'
import { locationFormSchema, type LocationFormValues } from '../schemas/practice-form'
import type { Location, Practice } from '../schemas/practice'
import { LocationFields } from './LocationFields'

/**
 * Add or edit one location of a practice.
 *
 * The practice is the one the screen has selected, as in the prototype: a
 * location is added from its practice's section, and there is no control to
 * move it to another. Whether a location may ever change practice is not
 * known, so the dialog does not offer it; `practice_id` is sent as it is.
 */
export function LocationDialog({
  practice,
  location,
  onClose,
}: {
  practice: Practice
  /** `null` adds a new location to `practice`. */
  location: Location | null
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateLocation()
  const update = useUpdateLocation()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: location
      ? locationToFormValues(location)
      : {
          code: '',
          name: '',
          npi: '',
          address: { line1: '', city: '', state: '', zip: '' },
          // PRD V2 §10.2: place of service defaults to 11.
          placeOfService: DEFAULT_PLACE_OF_SERVICE,
          // New locations start active, as in the prototype.
          isActive: true,
        },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: LocationFormValues) => {
    setFailure(null)
    try {
      if (location) await update.mutateAsync({ id: location.id, practiceId: practice.id, values })
      else await create.mutateAsync({ practiceId: practice.id, values })
      toast.success('Location saved')
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
      title={location ? `Edit ${location.name}` : 'Add location'}
      description={
        location ? `Update this location of ${practice.name}.` : `Add a location to ${practice.name}.`
      }
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {location ? 'Save location' : 'Add location'}
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
          <LocationFields readOnly={submitting} />
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

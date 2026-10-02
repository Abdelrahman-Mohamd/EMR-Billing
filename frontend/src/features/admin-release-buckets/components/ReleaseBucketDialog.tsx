import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input, Textarea } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { PracticeSelect } from '@/features/admin-practices'
import { useCreateReleaseBucket, useUpdateReleaseBucket } from '../queries/use-release-buckets'
import {
  releaseBucketFormSchema,
  type ReleaseBucket,
  type ReleaseBucketFormValues,
} from '../schemas/release-bucket'

/**
 * Add or edit a release bucket: practice, name and description — the payload's
 * fields and nothing more. The prototype's Active flag is left out; the
 * payload has no status.
 *
 * A new bucket starts with no practice chosen: the user picks one. On edit the
 * practice is shown but cannot be changed: whether a bucket may move to
 * another practice, with the insurances that name it, is not defined.
 */
export function ReleaseBucketDialog({
  bucket,
  onClose,
}: {
  /** `null` adds a new bucket. */
  bucket: ReleaseBucket | null
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateReleaseBucket()
  const update = useUpdateReleaseBucket()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ReleaseBucketFormValues>({
    resolver: zodResolver(releaseBucketFormSchema),
    defaultValues: bucket
      ? { practiceId: String(bucket.practiceId), name: bucket.name, description: bucket.description }
      : { practiceId: null, name: '', description: '' },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: ReleaseBucketFormValues) => {
    setFailure(null)
    try {
      if (bucket) await update.mutateAsync({ id: bucket.id, values })
      else await create.mutateAsync(values)
      toast.success('Release bucket saved')
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
      title={bucket ? bucket.name : 'New release bucket'}
      description={
        bucket
          ? "Update this bucket's name or description."
          : 'Add a release bucket to one of your practices.'
      }
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            Save bucket
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
            {...(bucket ? { info: 'The practice this bucket belongs to. It cannot be changed here.' } : {})}
          >
            {(field) => (
              <PracticeSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                disabled={submitting || bucket !== null}
              />
            )}
          </FormField>
          <FormField
            name="name"
            label="Name"
            required
            // V2: `release_bucket.name` is unique within its practice.
            info="No two release buckets of a practice can share a name."
          >
            {(field) => (
              <Input
                {...field}
                placeholder="Enter release bucket name"
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="description" label="Description">
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                placeholder="Describe when this release bucket is used"
                readOnly={submitting}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}

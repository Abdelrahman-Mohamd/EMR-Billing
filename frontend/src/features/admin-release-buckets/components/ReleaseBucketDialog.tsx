import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormNote } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input, Textarea } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { Switch } from '@/components/ui/Switch'
import { PracticeSelect } from '@/features/admin-practices'
import {
  useCreateReleaseBucket,
  useReleaseBucket,
  useUpdateReleaseBucket,
} from '../queries/use-release-buckets'
import {
  releaseBucketFormSchema,
  type ReleaseBucket,
  type ReleaseBucketFormValues,
} from '../schemas/release-bucket'

/**
 * Add or edit a release bucket, as the prototype's form has it: practice,
 * name, description and Active. Editing starts from the bucket as the server
 * has it now (`GET /release-buckets/{id}`; Save waits for it) and says how many
 * insurances are assigned to it (`insurances_count`).
 *
 * A new bucket starts with no practice chosen: the user picks one. On edit the
 * practice is shown but cannot be changed — the server refuses a save that
 * carries one.
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
  const [submitting, setSubmitting] = useState(false)
  const current = useReleaseBucket(bucket?.id ?? null)
  const ready = bucket === null || current.isSuccess

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={bucket ? bucket.name : 'New release bucket'}
      description={
        bucket
          ? "Update this bucket's name, description or status."
          : 'Add a release bucket to one of your practices.'
      }
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            Save bucket
          </Button>
        </>
      }
    >
      {bucket === null ? (
        <BucketForm formId={formId} bucket={null} onSubmittingChange={setSubmitting} onDone={onClose} />
      ) : current.isSuccess ? (
        <BucketForm
          formId={formId}
          bucket={current.data}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This bucket no longer exists"
            description="It may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={3} columns={1} />
      )}
    </Dialog>
  )
}

function BucketForm({
  formId,
  bucket,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  /** `null` adds a new bucket. */
  bucket: ReleaseBucket | null
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateReleaseBucket()
  const update = useUpdateReleaseBucket()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ReleaseBucketFormValues>({
    resolver: zodResolver(releaseBucketFormSchema),
    defaultValues: bucket
      ? {
          practiceId: String(bucket.practiceId),
          name: bucket.name,
          description: bucket.description,
          isActive: bucket.isActive,
        }
      : // New buckets start active, as in the prototype.
        { practiceId: null, name: '', description: '', isActive: true },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: ReleaseBucketFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    try {
      const message = bucket
        ? await update.mutateAsync({ id: bucket.id, values })
        : await create.mutateAsync(values)
      // The server's words; ours only when it sent none.
      toast.success(message ?? 'Release bucket saved')
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
        {bucket !== null && (
          <FormNote>
            {bucket.insurancesCount === 0
              ? 'No insurance is assigned to this bucket.'
              : `${bucket.insurancesCount === 1 ? '1 insurance is' : `${bucket.insurancesCount} insurances are`} assigned to this bucket.`}
          </FormNote>
        )}
      </FormGrid>
    </Form>
  )
}

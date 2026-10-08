import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormNote, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { Switch } from '@/components/ui/Switch'
import { PracticeSelect } from '@/features/admin-practices'
import { ICD_VERSIONS } from '../model/rules'
import {
  useCreateInsuranceClass,
  useInsuranceClass,
  useUpdateInsuranceClass,
} from '../queries/use-insurances'
import {
  insuranceClassFormSchema,
  NEW_INSURANCE_CLASS_VALUES,
  toInsuranceClassFormValues,
  type InsuranceClass,
  type InsuranceClassFormValues,
} from '../schemas/insurance-class'
import { RULE_INFO } from './rule-info'

const ICD_OPTIONS = ICD_VERSIONS.map((version) => ({ value: version, label: version }))

/**
 * Add or edit an insurance class, in the prototype's layout: code and name,
 * then the rule defaults its insurances inherit, then Active. Editing says
 * how many insurances are in the class (`insurances_count` — the class record
 * does not name them).
 *
 * Editing starts from the class as the server has it now
 * (`GET /insurance-classes/{id}`; Save waits for it). The practice is chosen
 * when the class is added and shown fixed when editing: the server refuses a
 * save that carries a practice — a class never moves.
 */
export function InsuranceClassDialog({
  insuranceClass,
  defaultPracticeId,
  onClose,
}: {
  /** `null` adds a new class. */
  insuranceClass: InsuranceClass | null
  /** Pre-selects the practice the list is filtered to, if any. */
  defaultPracticeId: string | null
  onClose: () => void
}) {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const current = useInsuranceClass(insuranceClass?.id ?? null)
  const ready = insuranceClass === null || current.isSuccess

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={insuranceClass ? `${insuranceClass.code} — ${insuranceClass.name}` : 'New insurance class'}
      description="Set the billing-rule defaults the insurances in this class inherit."
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            Save class
          </Button>
        </>
      }
    >
      {insuranceClass === null ? (
        <ClassForm
          formId={formId}
          insuranceClass={null}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isSuccess ? (
        <ClassForm
          formId={formId}
          insuranceClass={current.data}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This class no longer exists"
            description="It may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={4} columns={2} />
      )}
    </Dialog>
  )
}

function ClassForm({
  formId,
  insuranceClass,
  defaultPracticeId,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  /** `null` adds a new class. */
  insuranceClass: InsuranceClass | null
  defaultPracticeId: string | null
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateInsuranceClass()
  const update = useUpdateInsuranceClass()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<InsuranceClassFormValues>({
    resolver: zodResolver(insuranceClassFormSchema),
    defaultValues: insuranceClass
      ? toInsuranceClassFormValues(insuranceClass)
      : { practiceId: defaultPracticeId, ...NEW_INSURANCE_CLASS_VALUES },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: InsuranceClassFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    try {
      const message = insuranceClass
        ? await update.mutateAsync({ id: insuranceClass.id, values })
        : await create.mutateAsync(values)
      // The server's words; ours only when it sent none.
      toast.success(message ?? 'Class saved')
      onDone()
    } catch (error) {
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    } finally {
      onSubmittingChange(false)
    }
  }

  // How many insurances are in the class: the class record's own count.
  const membersNote =
    insuranceClass === null
      ? null
      : insuranceClass.insurancesCount === 0
        ? 'No insurance is in this class yet.'
        : `${insuranceClass.insurancesCount === 1 ? '1 insurance is' : `${insuranceClass.insurancesCount} insurances are`} in this class.`

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
          {...(insuranceClass
            ? { info: 'The practice this class belongs to. It cannot be changed here.' }
            : {})}
        >
          {(field) => (
            <PracticeSelect
              value={typeof field.value === 'string' ? field.value : null}
              onChange={field.onChange}
              disabled={submitting || insuranceClass !== null}
            />
          )}
        </FormField>
        <FormField
          name="code"
          label="Code"
          required
          span={4}
          // V2: `insurance_class.code` is unique within its practice.
          info="A short code for the class, up to 8 characters. No two classes of a practice can share one."
        >
          {(field) => (
            <Input
              {...field}
              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
              placeholder="Enter class code"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              readOnly={submitting}
            />
          )}
        </FormField>
        <FormField name="name" label="Name" required span={8}>
          {(field) => (
            <Input {...field} placeholder="Enter class name" autoComplete="off" readOnly={submitting} />
          )}
        </FormField>

        <FormSection title="Rule defaults">
          {RULE_INFO.map((rule) => (
            <FormField key={rule.key} name={rule.key} span={6}>
              {(field) => (
                <Switch
                  label={rule.label}
                  info={rule.info}
                  name={field.name}
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={submitting}
                />
              )}
            </FormField>
          ))}
          <FormField
            name="icdVersion"
            label="ICD version"
            required
            span={6}
            info="The diagnosis code set used on this class's claims."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={ICD_OPTIONS}
                placeholder="Select a version"
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

        {membersNote !== null && <FormNote>{membersNote}</FormNote>}
      </FormGrid>
    </Form>
  )
}

import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button, buttonClass } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormNote, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Select } from '@/components/ui/Select'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { Switch } from '@/components/ui/Switch'
import { PracticeSelect } from '@/features/admin-practices'
import { useReleaseBuckets } from '@/features/admin-release-buckets'
import { CLAIM_FORMATS, ICD_VERSIONS, INSURANCE_TYPES, insuranceLabel } from '../model/rules'
import {
  useCreateInsurance,
  useInsurance,
  useInsuranceClasses,
  useUpdateInsurance,
} from '../queries/use-insurances'
import {
  insuranceFormSchema,
  NEW_INSURANCE_VALUES,
  toInsuranceFormValues,
  type Insurance,
  type InsuranceDetail,
  type InsuranceFormValues,
} from '../schemas/insurance'
import { EffectiveRules } from './EffectiveRules'
import { RULE_INFO } from './rule-info'

const RULE_OPTIONS = [
  { value: 'inherit', label: 'Inherit from class' },
  { value: 'yes', label: 'Yes — override' },
  { value: 'no', label: 'No — override' },
]
const ICD_OPTIONS = [
  { value: 'inherit', label: 'Inherit from class' },
  ...ICD_VERSIONS.map((version) => ({ value: version, label: `${version} — override` })),
]
const TYPE_OPTIONS = INSURANCE_TYPES.map((type) => ({ value: type.value, label: type.label }))
const FORMAT_OPTIONS = CLAIM_FORMATS.map((format) => ({ value: format.value, label: format.label }))

/**
 * Add or edit an insurance, in the updated prototype's layout: payer details,
 * the billing rules (each inherited from the class or overridden, with the
 * effective values alongside), manual release, payer audit, submission & SLA,
 * the payer portal, and Active — the backend's fields (schemas/insurance.ts).
 *
 * Editing starts from the insurance as the server has it now
 * (`GET /insurances/{id}` — the list does not carry the address, phone, ICD
 * override, claim format, SLA or portal link; Save waits for it).
 *
 * Relationships: an insurance belongs to exactly one insurance class of its
 * practice (required; the server takes only an active one, so only active
 * classes are offered, plus the one already assigned); while its insurance
 * hold is on it names one release bucket of its practice (active buckets,
 * plus the one already named). Nothing is assigned automatically.
 *
 * The practice is chosen when the insurance is added and shown fixed when
 * editing: the server refuses a save that carries one. Changing the practice
 * while adding clears the class and bucket, which belong to the practice.
 *
 * The portal user and password are write-only: never returned, so the fields
 * start empty, and empty keeps the stored ones.
 */
export function InsuranceDialog({
  insurance,
  defaultPracticeId,
  onClose,
}: {
  /** `null` adds a new insurance. */
  insurance: Insurance | null
  /** Pre-selects the practice the list is filtered to, if any. */
  defaultPracticeId: string | null
  onClose: () => void
}) {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const current = useInsurance(insurance?.id ?? null)
  const ready = insurance === null || current.isSuccess

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={insurance ? insuranceLabel(insurance) : 'New insurance'}
      description={
        insurance
          ? "Update this payer's details and billing rules."
          : 'Add a payer as one of your practices bills it.'
      }
      size="lg"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            Save insurance
          </Button>
        </>
      }
    >
      {insurance === null ? (
        <InsuranceForm
          formId={formId}
          insurance={null}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isSuccess ? (
        <InsuranceForm
          formId={formId}
          insurance={current.data}
          defaultPracticeId={defaultPracticeId}
          onSubmittingChange={setSubmitting}
          onDone={onClose}
        />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This insurance no longer exists"
            description="It may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={6} columns={3} />
      )}
    </Dialog>
  )
}

function InsuranceForm({
  formId,
  insurance,
  defaultPracticeId,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  /** `null` adds a new insurance. */
  insurance: InsuranceDetail | null
  defaultPracticeId: string | null
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateInsurance()
  const update = useUpdateInsurance()
  const classes = useInsuranceClasses()
  const buckets = useReleaseBuckets()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<InsuranceFormValues>({
    resolver: zodResolver(insuranceFormSchema),
    defaultValues: insurance
      ? toInsuranceFormValues(insurance)
      : { practiceId: defaultPracticeId, ...NEW_INSURANCE_VALUES },
  })
  const submitting = form.formState.isSubmitting
  const [practiceId, classId, held] = useWatch({
    control: form.control,
    name: ['practiceId', 'insuranceClassId', 'insuranceHold'],
  })

  const practiceClasses = (classes.data ?? []).filter(
    (insuranceClass) =>
      String(insuranceClass.practiceId) === practiceId &&
      (insuranceClass.isActive || String(insuranceClass.id) === String(insurance?.insuranceClassId)),
  )
  const classOptions = practiceClasses.map((insuranceClass) => ({
    value: String(insuranceClass.id),
    label: `${insuranceClass.code} — ${insuranceClass.name}`,
    ...(insuranceClass.isActive ? {} : { description: 'Inactive' }),
  }))
  const chosenClass = practiceClasses.find((insuranceClass) => String(insuranceClass.id) === classId) ?? null
  // The practice's active buckets, plus the one already named.
  const bucketOptions = (buckets.data ?? [])
    .filter(
      (bucket) =>
        String(bucket.practiceId) === practiceId &&
        (bucket.isActive || bucket.id === insurance?.releaseBucketId),
    )
    .map((bucket) => ({
      value: String(bucket.id),
      label: bucket.name,
      ...(bucket.isActive ? {} : { description: 'Inactive' }),
    }))
  const noActiveClass =
    insurance === null && practiceId !== null && classes.isSuccess && practiceClasses.length === 0

  const onSubmit = async (values: InsuranceFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    try {
      const message = insurance ? await update(insurance.id, values) : await create(values)
      // The server's words; ours only when it sent none.
      toast.success(message ?? 'Insurance saved')
      onDone()
    } catch (error) {
      // Nothing here ever repeats what was typed into the portal password.
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    } finally {
      onSubmittingChange(false)
    }
  }

  const switchField = (
    name: 'insuranceHold' | 'auditRequired' | 'isActive',
    label: string,
    info?: string,
  ) => (
    <FormField name={name}>
      {(field) => (
        <Switch
          label={label}
          {...(info === undefined ? {} : { info })}
          name={field.name}
          checked={field.value === true}
          onCheckedChange={field.onChange}
          onBlur={field.onBlur}
          disabled={submitting}
        />
      )}
    </FormField>
  )

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
          {...(insurance ? { info: 'The practice that bills this payer. It cannot be changed here.' } : {})}
        >
          {(field) => (
            <PracticeSelect
              value={typeof field.value === 'string' ? field.value : null}
              onChange={(value) => {
                field.onChange(value)
                // The class and the bucket belong to the practice.
                form.setValue('insuranceClassId', null)
                form.setValue('releaseBucketId', null)
              }}
              disabled={submitting || insurance !== null}
            />
          )}
        </FormField>
        {noActiveClass && (
          <div className="col-span-12">
            <Notice
              tone="warning"
              title="No insurance class yet."
              action={
                <Link
                  to="/setup/insurance-classes"
                  search={{ practice: Number(practiceId) }}
                  className={buttonClass('default', 'sm')}
                >
                  Create an insurance class
                </Link>
              }
            >
              Every insurance belongs to one class of its practice, and this practice has no active class.
            </Notice>
          </div>
        )}

        <FormSection title="Payer">
          <FormField
            name="code"
            label="Code"
            required
            span={3}
            // V2: `insurance.code` is a number, unique within its practice.
            info="A number that identifies the payer in this practice. No two insurances of a practice can share one."
          >
            {(field) => (
              <Input
                {...field}
                placeholder="Enter code"
                inputMode="numeric"
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="name" label="Name" required span={9}>
            {(field) => (
              <Input {...field} placeholder="Enter insurance name" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField
            name="insuranceClassId"
            label="Insurance class"
            required
            span={4}
            info="The insurance inherits its billing-rule defaults from its class."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={classOptions}
                placeholder={practiceId === null ? 'Select a practice first' : 'Select a class'}
                disabled={submitting || practiceId === null}
              />
            )}
          </FormField>
          <FormField
            name="insuranceType"
            label="Insurance type"
            required
            span={4}
            info="The claim filing indicator sent on the claim."
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
          <FormField name="payerId" label="Payer ID" span={4} info="The payer's ID at the clearinghouse.">
            {(field) => (
              <Input {...field} placeholder="Enter payer ID" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField name="address.line1" label="Claims address" span={12}>
            {(field) => (
              <Input {...field} placeholder="Enter street address" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField name="address.line2" label="Suite" span={12}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter suite, unit or floor"
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="address.city" label="City" span={6}>
            {(field) => (
              <Input {...field} placeholder="Enter city" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField name="address.state" label="State" span={3}>
            {(field) => (
              <Input
                {...field}
                // Shown as it will be saved: a two-letter code in capitals.
                onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                placeholder="Enter state"
                maxLength={2}
                autoCapitalize="characters"
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="address.zip" label="ZIP" span={3}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter ZIP code"
                inputMode="numeric"
                maxLength={5}
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
        </FormSection>

        <FormSection title="Billing rules">
          <FormNote>Each rule uses the class value unless you override it for this insurance.</FormNote>
          {RULE_INFO.map((rule) => (
            <FormField key={rule.key} name={rule.key} label={rule.label} info={rule.info} span={4}>
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={field.onChange}
                  options={RULE_OPTIONS}
                  disabled={submitting}
                />
              )}
            </FormField>
          ))}
          <FormField
            name="icdVersion"
            label="ICD version"
            span={4}
            info="The diagnosis code set used on this payer's claims."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={ICD_OPTIONS}
                disabled={submitting}
              />
            )}
          </FormField>
          <EffectiveRules classRules={chosenClass} className="col-span-12" />
        </FormSection>

        <FormSection title="Manual release">
          <div className="col-span-12">
            {switchField(
              'insuranceHold',
              'Insurance hold',
              'Claims for this payer stop in a release bucket after scrubbing and go out only when a user releases them.',
            )}
          </div>
          {held && (
            <FormField name="releaseBucketId" label="Release bucket" required span={6}>
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={field.onChange}
                  options={bucketOptions}
                  placeholder={
                    bucketOptions.length === 0 ? 'No active bucket in this practice' : 'Select a bucket'
                  }
                  disabled={submitting || practiceId === null}
                />
              )}
            </FormField>
          )}
        </FormSection>

        <FormSection title="Payer audit">
          <div className="col-span-12">
            {switchField(
              'auditRequired',
              'Audit required',
              'Claims for this payer wait until a reviewer records the documents attached; they are submitted after that.',
            )}
          </div>
        </FormSection>

        <FormSection title="Submission & SLA">
          <FormField name="claimFormat" label="Claim format" required span={6}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={FORMAT_OPTIONS}
                placeholder="Select a claim format"
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField
            name="slaDays"
            label="Payment SLA (days)"
            span={6}
            info="How many days the payer has to pay a claim before it goes to A/R follow-up."
          >
            {(field) => (
              <Input
                {...field}
                placeholder="Enter days"
                inputMode="numeric"
                maxLength={3}
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title="Payer portal">
          <FormField
            name="portalUrl"
            label="Payer portal link"
            span={12}
            info="Where this payer's claims and remittances are checked online."
          >
            {(field) => (
              <Input
                {...field}
                type="url"
                inputMode="url"
                placeholder="Enter payer portal URL"
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField
            name="portalUser"
            label="Portal user"
            span={6}
            {...(insurance
              ? { info: 'Never shown once saved. Leave it empty to keep the current one.' }
              : {})}
          >
            {(field) => (
              <Input
                {...field}
                placeholder={insurance ? 'Enter a new portal user' : 'Enter portal user'}
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField
            name="portalPassword"
            label="Portal password"
            span={6}
            {...(insurance
              ? { info: 'Never shown once saved. Leave it empty to keep the current one.' }
              : {})}
          >
            {(field) => (
              <PasswordInput
                {...field}
                placeholder={insurance ? 'Enter a new portal password' : 'Enter portal password'}
                // The payer's password, not the admin's own: the browser must not fill it in.
                autoComplete="new-password"
                readOnly={submitting}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title="Status">
          <div className="col-span-12">{switchField('isActive', 'Active')}</div>
        </FormSection>
      </FormGrid>
    </Form>
  )
}

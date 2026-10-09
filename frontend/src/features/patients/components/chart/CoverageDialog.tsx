import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { insuranceLabel, type Insurance } from '@/features/admin-insurances'
import { todayIso } from '@/lib/utils/dates'
import { GENDERS } from '../../model/patient'
import { RANKS, SUBSCRIBER_RELATIONSHIPS, WORKERS_COMP, type Coverage } from '../../model/coverage'
import {
  coverageFormSchema,
  newCoverageValues,
  toCoverageFormValues,
  type CoverageFormValues,
} from '../../schemas/coverage-form'

/**
 * Add or edit one of a case's insurances, in the prototype's sections: the
 * insurance and its rank, the member ID, group and claim numbers, and the
 * dates it is in effect; the Subscriber; the Employer (Workers' Comp).
 *
 * The insurance is chosen when the coverage is added and fixed afterwards —
 * the server refuses a save that carries one. The subscriber's details are
 * asked for only when the patient is not the subscriber, and the employer only
 * for Workers' Comp (or a coverage that already names one). Saving waits for
 * the server; its field errors land on the fields, its other refusals (a
 * claim number Workers' Comp needs) show above them, and the dialog stays.
 */
export function CoverageDialog({
  coverage,
  insurances,
  nextRank,
  onSave,
  onClose,
}: {
  /** `null` adds a coverage. */
  coverage: Coverage | null
  /** The practice's active insurances (and the coverage's own, if it is no longer active). */
  insurances: readonly Insurance[]
  /** A new coverage's rank: the first one the case does not hold yet. */
  nextRank: string | null
  /** Resolves with the server's message. */
  onSave: (values: CoverageFormValues) => Promise<unknown>
  onClose: () => void
}) {
  const formId = useId()
  const today = todayIso()
  const [failure, setFailure] = useState<string | null>(null)
  const typeOf = (id: string | null) =>
    insurances.find((item) => String(item.id) === id)?.insuranceType ??
    (coverage !== null && String(coverage.insuranceId) === id ? coverage.insuranceType : undefined)
  const form = useForm<CoverageFormValues>({
    resolver: zodResolver(coverageFormSchema(today, typeOf)),
    defaultValues: coverage === null ? newCoverageValues(nextRank) : toCoverageFormValues(coverage),
  })
  const submitting = form.formState.isSubmitting
  const [insuranceId, relationship] = useWatch({
    control: form.control,
    name: ['insuranceId', 'subscriberRelationship'],
  })
  const workersComp = typeOf(insuranceId) === WORKERS_COMP
  const showEmployer = workersComp || (coverage?.employer ?? null) !== null
  // A saved coverage keeps its insurance, offered or not.
  const options =
    coverage === null
      ? insurances.map((item) => ({ value: String(item.id), label: insuranceLabel(item) }))
      : [
          {
            value: String(coverage.insuranceId),
            label: coverage.insuranceLabel || coverage.insuranceName || 'Insurance',
          },
        ]

  const text = (
    name: keyof CoverageFormValues,
    label: string,
    span: 3 | 4 | 6 | 12,
    placeholder: string,
    extra: { required?: boolean; info?: string; upper?: boolean; maxLength?: number } = {},
  ) => (
    <FormField
      name={name}
      label={label}
      span={span}
      {...(extra.required === true ? { required: true } : {})}
      {...(extra.info === undefined ? {} : { info: extra.info })}
    >
      {(field) => (
        <Input
          {...field}
          value={typeof field.value === 'string' ? field.value : ''}
          {...(extra.upper === true
            ? { onChange: (event) => field.onChange(event.target.value.toUpperCase()) }
            : {})}
          placeholder={placeholder}
          autoComplete="off"
          readOnly={submitting}
          {...(extra.maxLength === undefined ? {} : { maxLength: extra.maxLength })}
        />
      )}
    </FormField>
  )
  const date = (name: 'subscriberDob' | 'effectiveDate' | 'terminationDate', label: string, max?: string) => (
    <FormField name={name} label={label} span={4}>
      {(field) => (
        <DateInput
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          {...(max === undefined ? {} : { max })}
          disabled={submitting}
        />
      )}
    </FormField>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={coverage === null ? 'Add insurance' : 'Edit insurance'}
      {...(coverage === null
        ? {
            description:
              'Adds one of the practice’s insurances to this case, with its priority and policy details.',
          }
        : {})}
      size="lg"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {coverage === null ? 'Add insurance' : 'Save insurance'}
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          try {
            await onSave(values)
            onClose()
          } catch (error) {
            const leftover = applyServerErrors(form, error)
            setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
          }
        }}
      >
        <FormGrid>
          {failure !== null && (
            <div className="col-span-12">
              <Notice tone="critical">{failure}</Notice>
            </div>
          )}
          <FormField
            name="insuranceId"
            label="Insurance"
            required
            span={8}
            {...(coverage === null
              ? { info: 'An insurance is on a case once.' }
              : { info: 'The insurance of a saved coverage cannot be changed.' })}
          >
            {(field) => (
              <SearchSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={options}
                placeholder="Select an insurance"
                searchPlaceholder="Search insurances"
                disabled={coverage !== null || submitting}
              />
            )}
          </FormField>
          <FormField
            name="rank"
            label="Priority"
            required
            span={4}
            info="Primary, secondary or tertiary — the order the claim goes to the case’s insurances."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={RANKS}
                placeholder="Select priority"
                disabled={submitting}
              />
            )}
          </FormField>
          {text('memberId', 'Member ID', 4, 'Enter member ID, as on the card', { required: true })}
          {text('groupNumber', 'Group number', 4, 'Enter group number')}
          {text('claimNumber', 'Claim number', 4, 'Enter WC / auto claim number', {
            required: workersComp,
            info: 'Box 11b. Required for Workers’ Comp.',
          })}
          {date('effectiveDate', 'Effective date')}
          {date('terminationDate', 'Termination date')}

          <FormSection title="Subscriber">
            {/* A one-line label, so the subscriber's fields line up beside it. */}
            <FormField
              name="subscriberRelationship"
              label="Relationship"
              span={4}
              info="The patient’s relationship to the subscriber (Box 6 on the claim). Self: the patient is the insured."
            >
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={(next) => {
                    if (next !== null) field.onChange(next)
                  }}
                  options={SUBSCRIBER_RELATIONSHIPS.map((value) => ({ value, label: value }))}
                  disabled={submitting}
                />
              )}
            </FormField>
            {relationship !== 'Self' && (
              <>
                {text('subscriberFirstName', 'First name', 4, 'Enter first name', { required: true })}
                {text('subscriberLastName', 'Last name', 4, 'Enter last name', { required: true })}
                {date('subscriberDob', 'Subscriber DOB', today)}
                <FormField name="subscriberGender" label="Gender" span={4}>
                  {(field) => (
                    <Select
                      value={typeof field.value === 'string' ? field.value : null}
                      onChange={field.onChange}
                      options={GENDERS}
                      placeholder="Select gender"
                      clearable
                      disabled={submitting}
                    />
                  )}
                </FormField>
              </>
            )}
          </FormSection>

          {showEmployer && (
            <FormSection title="Employer (Workers’ Comp)">
              {text('employerName', 'Employer name', 12, 'Enter employer name')}
              {text('employerLine1', 'Employer address', 6, 'Enter street address', {
                info: 'Leave the address empty, or give all of it: street, city, state and ZIP.',
              })}
              {text('employerCity', 'City', 6, 'Enter city')}
              {text('employerState', 'State', 3, 'Enter state', { upper: true, maxLength: 2 })}
              {text('employerZip', 'ZIP', 3, 'Enter ZIP', { maxLength: 5 })}
            </FormSection>
          )}
        </FormGrid>
      </Form>
    </Dialog>
  )
}

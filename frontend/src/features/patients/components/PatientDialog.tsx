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
import { Input, Textarea } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { Select, type SelectOption } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { PracticeSelect } from '@/features/admin-practices'
import { todayIso } from '@/lib/utils/dates'
import { GENDERS, GUARANTOR_RELATIONSHIPS, fullName, type Patient } from '../model/patient'
import {
  GUARANTOR_TYPES,
  NAME_LIMITS,
  newPatientValues,
  patientFormSchema,
  toPatientFormValues,
  type PatientFormValues,
} from '../schemas/patient-form'

const RELATIONSHIP_OPTIONS: readonly SelectOption[] = GUARANTOR_RELATIONSHIPS.map((value) => ({
  value,
  label: value,
}))

/** A saved value the lists do not offer is kept and shown as it is. */
const withCurrent = (options: readonly SelectOption[], current: string | null): readonly SelectOption[] =>
  current === null || options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }]

/**
 * New or edit a patient, in the prototype's sections: Patient, Contact,
 * Address, Guarantor (responsible party), Notes — and, for a new patient, that
 * a "Default" case comes with it. A new patient also names its practice; it
 * cannot change afterwards (the server refuses it).
 *
 * The guarantor is asked for only when another person receives the
 * statements. The SSN on file is never put in the field: it shows masked as
 * the placeholder, and a value typed in replaces it; left empty, it is not
 * sent, so the one on file stays.
 *
 * Saving waits for the server; its message is shown, its field errors land on
 * the fields, and the dialog stays open when it refuses.
 */
export function PatientDialog({
  patient,
  defaultPracticeId,
  onSave,
  onClose,
}: {
  /** `null` adds a new patient. */
  patient: Patient | null
  /** The practice a new patient starts in — the list's filter, when there is one. */
  defaultPracticeId: string | null
  /** Resolves with the server's message. */
  onSave: (values: PatientFormValues) => Promise<string | null>
  onClose: () => void
}) {
  const formId = useId()
  const isNew = patient === null
  const today = todayIso()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema({ isNew, today })),
    defaultValues: patient === null ? newPatientValues(defaultPracticeId) : toPatientFormValues(patient),
  })
  const submitting = form.formState.isSubmitting
  const guarantorType = useWatch({ control: form.control, name: 'guarantorType' })

  const onSubmit = async (values: PatientFormValues) => {
    setFailure(null)
    try {
      const message = await onSave(values)
      // The server's words; ours only when it sent none.
      toast.success(message ?? (isNew ? 'Patient created' : 'Patient saved'))
      onClose()
    } catch (error) {
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    }
  }

  const text = (
    name: keyof PatientFormValues,
    label: string,
    span: 3 | 4 | 6 | 8 | 12,
    placeholder: string,
    extra: {
      required?: boolean
      info?: string
      maxLength?: number
      inputMode?: 'tel' | 'email' | 'numeric'
      upper?: boolean
    } = {},
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
          {...(extra.inputMode === undefined ? {} : { inputMode: extra.inputMode })}
        />
      )}
    </FormField>
  )
  const select = (
    name: 'gender' | 'guarantorRelationship',
    label: string,
    span: 4 | 6,
    choices: readonly SelectOption[],
    extra: { required?: boolean } = {},
  ) => (
    <FormField name={name} label={label} span={span} {...(extra.required === true ? { required: true } : {})}>
      {(field) => {
        const value = typeof field.value === 'string' ? field.value : null
        return (
          <Select
            value={value}
            onChange={field.onChange}
            options={withCurrent(choices, value)}
            placeholder={`Select ${label.toLowerCase()}`}
            disabled={submitting}
          />
        )
      }}
    </FormField>
  )
  const date = (name: 'dob' | 'guarantorDob', label: string, span: 4 | 6, required: boolean) => (
    <FormField name={name} label={label} span={span} {...(required ? { required: true } : {})}>
      {(field) => (
        <DateInput
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          max={today}
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
      title={patient === null ? 'New patient' : `Edit ${fullName(patient)}`}
      {...(isNew
        ? {
            description:
              'Patients usually arrive from the EMR with their first finalized note. Add one by hand when a charge is entered manually.',
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
            {isNew ? 'Create patient' : 'Save patient'}
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
          <FormSection title="Patient">
            {isNew && (
              <FormField name="practiceId" label="Practice" required span={8}>
                {(field) => (
                  <PracticeSelect
                    value={typeof field.value === 'string' ? field.value : null}
                    onChange={field.onChange}
                    disabled={submitting}
                  />
                )}
              </FormField>
            )}
            {text('emrId', 'EMR ID', 4, 'Enter EMR ID', {
              inputMode: 'numeric',
              info: 'The patient’s id in the EMR — the sync key. No two patients can share one.',
            })}
            {text('firstName', 'First name', 4, 'Enter first name', {
              required: true,
              maxLength: NAME_LIMITS.first,
            })}
            {text('middleName', 'Middle name', 4, 'Enter middle name', { maxLength: NAME_LIMITS.middle })}
            {text('lastName', 'Last name', 4, 'Enter last name', { required: true })}
            {date('dob', 'Date of birth', 4, true)}
            {select('gender', 'Gender', 4, GENDERS, { required: true })}
            {text(
              'ssn',
              'SSN',
              4,
              patient !== null && patient.maskedSsn !== ''
                ? `${patient.maskedSsn} — enter a new value to replace`
                : 'Enter SSN (000-00-0000)',
              {
                info: 'Stored encrypted and shown masked. Left empty, the SSN on file is kept.',
                maxLength: 11,
              },
            )}
          </FormSection>

          <FormSection title="Contact">
            {text('phoneCell', 'Cell phone', 4, 'Enter cell phone (000-000-0000)', { inputMode: 'tel' })}
            {text('phoneHome', 'Home phone', 4, 'Enter home phone (000-000-0000)', { inputMode: 'tel' })}
            {text('email', 'Email', 4, 'Enter email', { inputMode: 'email' })}
          </FormSection>

          <FormSection title="Address">
            {text('line1', 'Street address', 8, 'Enter street and number', {
              required: true,
              info: 'Box 5.',
            })}
            {text('line2', 'Apt, suite', 4, 'Enter apt or suite')}
            {text('city', 'City', 6, 'Enter city', { required: true })}
            {text('state', 'State', 3, 'Enter state', { required: true, maxLength: 2, upper: true })}
            {text('zip', 'ZIP', 3, 'Enter ZIP', { required: true, maxLength: 5, inputMode: 'numeric' })}
          </FormSection>

          <FormSection title="Guarantor (responsible party)">
            <FormField name="guarantorType" label="Who receives statements" span={6}>
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={(next) => {
                    if (next === 'self' || next === 'other') field.onChange(next)
                  }}
                  options={GUARANTOR_TYPES}
                  disabled={submitting}
                />
              )}
            </FormField>
            {/* The guarantor, when it is someone else. */}
            {guarantorType === 'other' && (
              <>
                {select('guarantorRelationship', 'Relationship', 6, RELATIONSHIP_OPTIONS, { required: true })}
                {text('guarantorFirstName', 'First name', 4, 'Enter first name', { required: true })}
                {text('guarantorLastName', 'Last name', 4, 'Enter last name', { required: true })}
                {date('guarantorDob', 'Date of birth', 4, false)}
                {text('guarantorLine1', 'Guarantor address', 6, 'Enter street address', {
                  info: 'Leave the address empty, or give all of it: street, city, state and ZIP.',
                })}
                {text('guarantorCity', 'City', 6, 'Enter city')}
                {text('guarantorState', 'State', 3, 'Enter state', { maxLength: 2, upper: true })}
                {text('guarantorZip', 'ZIP', 3, 'Enter ZIP', { maxLength: 5, inputMode: 'numeric' })}
              </>
            )}
            <FormField name="noStatements">
              {(field) => (
                <Switch
                  label="Don’t send statements"
                  info="No patient statements are sent for this patient, to them or to the guarantor."
                  name={field.name}
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={submitting}
                />
              )}
            </FormField>
          </FormSection>

          <FormSection title="Notes">
            <FormField name="notes" label="Internal notes" span={12}>
              {(field) => (
                <Textarea
                  {...field}
                  value={typeof field.value === 'string' ? field.value : ''}
                  rows={2}
                  placeholder="Enter notes (visible to staff only)"
                  readOnly={submitting}
                />
              )}
            </FormField>
          </FormSection>

          {isNew && (
            <FormSection title="First case">
              <FormNote>
                A “Default” case is created with the patient. Add the patient’s insurance, then give the case
                its referring physician, primary insurance and diagnoses before billing.
              </FormNote>
            </FormSection>
          )}
        </FormGrid>
      </Form>
    </Dialog>
  )
}

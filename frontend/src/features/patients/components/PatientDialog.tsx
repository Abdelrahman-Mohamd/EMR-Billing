import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormNote, FormSection } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PracticeSelect } from '@/features/admin-practices'
import { todayIso } from '@/lib/utils/dates'
import { GENDERS, GUARANTOR_RELATIONSHIPS, fullName, maskSsn, type Patient } from '../model/patient'
import {
  GUARANTOR_TYPES,
  newPatientValues,
  patientFormSchema,
  toPatientFormValues,
  type PatientFormValues,
} from '../schemas/patient-form'

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }))

/**
 * New or edit a patient, in the prototype's sections: Patient, Contact,
 * Address, Guarantor (responsible party), Notes — and, for a new patient, that
 * a "Default" case comes with it. A new patient also names its practice: there
 * is no current practice here to take it from.
 *
 * The guarantor's name, relationship and address are asked for only when
 * another person receives the statements (the prototype showed them always and
 * required them only then).
 *
 * The SSN on file is never put in the field: it shows masked as the
 * placeholder, and a value typed in replaces it.
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
  onSave: (values: PatientFormValues) => void
  onClose: () => void
}) {
  const formId = useId()
  const isNew = patient === null
  const today = todayIso()
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema({ isNew, today })),
    defaultValues: patient === null ? newPatientValues(defaultPracticeId) : toPatientFormValues(patient),
  })
  const guarantorType = useWatch({ control: form.control, name: 'guarantorType' })

  const text = (
    name: keyof PatientFormValues,
    label: string,
    span: 3 | 4 | 6 | 8 | 12,
    placeholder: string,
    extra: { required?: boolean; info?: string; maxLength?: number; inputMode?: 'tel' | 'email' } = {},
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
          placeholder={placeholder}
          autoComplete="off"
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
    choices: readonly string[],
    extra: { required?: boolean } = {},
  ) => (
    <FormField name={name} label={label} span={span} {...(extra.required === true ? { required: true } : {})}>
      {(field) => (
        <Select
          value={typeof field.value === 'string' ? field.value : null}
          onChange={field.onChange}
          options={options(choices)}
          placeholder={`Select ${label.toLowerCase()}`}
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
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            {isNew ? 'Create patient' : 'Save patient'}
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          onSave(values)
          onClose()
        }}
      >
        <FormGrid>
          <FormSection title="Patient">
            {isNew && (
              <FormField name="practiceId" label="Practice" required span={12}>
                {(field) => (
                  <PracticeSelect
                    value={typeof field.value === 'string' ? field.value : null}
                    onChange={field.onChange}
                  />
                )}
              </FormField>
            )}
            {text('firstName', 'First name', 4, 'Enter first name', { required: true, maxLength: 40 })}
            {text('middleName', 'Middle name', 4, 'Enter middle name (optional)', { maxLength: 30 })}
            {text('lastName', 'Last name', 4, 'Enter last name', { required: true, maxLength: 40 })}
            <FormField name="dob" label="Date of birth" required span={4}>
              {(field) => (
                <DateInput
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  max={today}
                />
              )}
            </FormField>
            {select('gender', 'Gender', 4, GENDERS, { required: true })}
            {text(
              'ssn',
              'SSN',
              4,
              patient !== null && patient.ssn !== ''
                ? `${maskSsn(patient.ssn)} — enter a new value to replace`
                : 'Enter SSN (000-00-0000)',
              {
                info: 'Stored encrypted; masked for everyone but System Admin.',
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
            {text('line2', 'Apt, suite', 4, 'Enter apt or suite (optional)')}
            {text('city', 'City', 6, 'Enter city', { required: true })}
            {text('state', 'State', 3, 'Enter state', { required: true, maxLength: 2 })}
            {text('zip', 'ZIP', 3, 'Enter ZIP', { required: true, maxLength: 5 })}
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
                />
              )}
            </FormField>
            {/* The guarantor and their address, when it is someone else. */}
            {guarantorType === 'other' && (
              <>
                {text('guarantorName', 'Guarantor name', 6, 'Enter full name', { required: true })}
                {select('guarantorRelationship', 'Relationship', 6, GUARANTOR_RELATIONSHIPS, {
                  required: true,
                })}
                {text('guarantorLine1', 'Guarantor address', 6, 'Enter street address', { required: true })}
                {text('guarantorCity', 'City', 6, 'Enter city', { required: true })}
                {text('guarantorState', 'State', 3, 'Enter state', { required: true, maxLength: 2 })}
                {text('guarantorZip', 'ZIP', 3, 'Enter ZIP', { required: true, maxLength: 5 })}
              </>
            )}
          </FormSection>

          <FormSection title="Notes">
            <FormField name="notes" label="Internal notes" span={12}>
              {(field) => (
                <Textarea
                  {...field}
                  value={typeof field.value === 'string' ? field.value : ''}
                  rows={2}
                  placeholder="Enter notes (visible to staff only)"
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

import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { fullName, usePatientRecords, type Patient } from '@/features/patients'
import type { BillingException } from '../../model/billing-exception'
import { LIMITS, isDummyPhone, truncated, zipState } from '../../model/checks'
import {
  addressFixSchema,
  lengthFixSchema,
  phoneFixSchema,
  type AddressFixValues,
  type LengthFixValues,
  type PhoneFixValues,
} from '../../schemas/resolve-forms'
import { ResolveFrame } from './ResolveFrame'

interface PatientFixProps {
  exception: BillingException
  patient: Patient
  /** The fix is saved: resolve what it settles. `label` leads the toast. */
  onDone: (label: string) => void
  onClose: () => void
}

/** The patient as the store takes it back: everything but what the system assigns. */
function valuesOf(patient: Patient) {
  const { id: _id, billingId: _billingId, emrId: _emrId, isActive: _isActive, ...values } = patient
  return values
}

/** "Fix phone — Victor Moreau": a placeholder number such as 000-000-0000. */
export function PhoneFix({ exception, patient, onDone, onClose }: PatientFixProps) {
  const formId = useId()
  const records = usePatientRecords()
  const form = useForm<PhoneFixValues>({
    resolver: zodResolver(phoneFixSchema),
    // A placeholder is not offered back for editing, as in the prototype.
    defaultValues: {
      phoneCell: isDummyPhone(patient.phoneCell) ? '' : patient.phoneCell,
      phoneHome: isDummyPhone(patient.phoneHome) ? '' : patient.phoneHome,
    },
  })
  return (
    <ResolveFrame
      exception={exception}
      title={`Fix phone — ${fullName(patient)}`}
      description="Placeholder numbers such as 000-000-0000 are flagged."
      formId={formId}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          records.updatePatient(patient.id, { ...valuesOf(patient), ...values })
          onDone('Patient updated')
        }}
      >
        <FormGrid>
          <FormField name="phoneCell" label="Cell phone" span={6}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter cell phone (000-000-0000)"
                inputMode="tel"
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField name="phoneHome" label="Home phone" span={6}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter home phone (000-000-0000)"
                inputMode="tel"
                autoComplete="off"
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}

/** "Fix address — Grace Holloway": the ZIP code does not belong to the state. */
export function AddressFix({ exception, patient, onDone, onClose }: PatientFixProps) {
  const formId = useId()
  const records = usePatientRecords()
  const { line1, city, state, zip } = patient.address
  const form = useForm<AddressFixValues>({
    resolver: zodResolver(addressFixSchema),
    defaultValues: { line1, city, state, zip },
  })
  return (
    <ResolveFrame
      exception={exception}
      title={`Fix address — ${fullName(patient)}`}
      description={`ZIP codes are cross-referenced against the state. ${zip} belongs to ${zipState(zip) ?? 'an unknown state'}.`}
      formId={formId}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          records.updatePatient(patient.id, {
            ...valuesOf(patient),
            address: { ...patient.address, ...values },
          })
          onDone('Patient updated')
        }}
      >
        <FormGrid>
          <FormField name="line1" label="Street address" required span={12}>
            {(field) => <Input {...field} placeholder="Enter street and number" autoComplete="off" />}
          </FormField>
          <FormField name="city" label="City" required span={6}>
            {(field) => <Input {...field} placeholder="Enter city" autoComplete="off" />}
          </FormField>
          <FormField name="state" label="State" required span={3}>
            {(field) => <Input {...field} placeholder="Enter state" maxLength={2} autoComplete="off" />}
          </FormField>
          <FormField name="zip" label="ZIP" required span={3}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter ZIP"
                maxLength={5}
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}

/** "Fix field length": the name or the address line is longer than a claim allows. */
export function LengthFix({ exception, patient, onDone, onClose }: PatientFixProps) {
  const formId = useId()
  const records = usePatientRecords()
  const form = useForm<LengthFixValues>({
    resolver: zodResolver(lengthFixSchema),
    defaultValues: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      middleName: patient.middleName,
      line1: patient.address.line1,
    },
  })
  return (
    <ResolveFrame
      exception={exception}
      title={`Fix field length — ${fullName(patient)}`}
      description="Some values are longer than a claim allows. Edit them, or use the shortened version and review it before saving."
      formId={formId}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          const { line1, ...name } = values
          records.updatePatient(patient.id, {
            ...valuesOf(patient),
            ...name,
            address: { ...patient.address, line1 },
          })
          onDone('Patient updated')
        }}
      >
        <FormGrid>
          <FormField name="firstName" label="First name" required span={6}>
            {(field) => <Input {...field} placeholder="Enter first name" autoComplete="off" />}
          </FormField>
          <FormField name="lastName" label="Last name" required span={6}>
            {(field) => <Input {...field} placeholder="Enter last name" autoComplete="off" />}
          </FormField>
          <FormField name="middleName" label="Middle name" span={6}>
            {(field) => <Input {...field} placeholder="Enter middle name" autoComplete="off" />}
          </FormField>
          <FormField name="line1" label="Street address" required span={12}>
            {(field) => <Input {...field} placeholder="Enter street and number" autoComplete="off" />}
          </FormField>
          <div className="col-span-12">
            <Button
              size="sm"
              onClick={() => {
                const next = truncated(form.getValues())
                for (const key of ['firstName', 'middleName', 'lastName', 'line1'] as const)
                  form.setValue(key, next[key], { shouldDirty: true })
                toast.info('Truncated values filled in', 'Review them, then save.')
              }}
            >
              Fill in a truncated version (name {LIMITS.name}, address {LIMITS.addressLine} characters)
            </Button>
          </div>
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}

import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { userMessage } from '@/lib/api/api-error'
import { fullName, showPhone, useUpdatePatientFields, type Patient } from '@/features/patients'
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

const digits = (value: string) => value.replace(/\D/g, '')

/**
 * A fix saves the fields it changes and nothing else — the rest of the
 * patient's record stays as it is on the server. Its error stays in the dialog.
 */
function usePatientFix(patient: Patient, onDone: (label: string) => void) {
  const update = useUpdatePatientFields()
  const [failure, setFailure] = useState<string | null>(null)
  const save = async (fields: Parameters<typeof update.mutateAsync>[0]['fields']) => {
    setFailure(null)
    try {
      await update.mutateAsync({ id: patient.id, fields })
      onDone('Patient updated')
    } catch (error) {
      setFailure(userMessage(error))
    }
  }
  return { save, busy: update.isPending, failure }
}

/** "Fix phone — Victor Moreau": a placeholder number such as 000-000-0000. */
export function PhoneFix({ exception, patient, onDone, onClose }: PatientFixProps) {
  const formId = useId()
  const fix = usePatientFix(patient, onDone)
  const form = useForm<PhoneFixValues>({
    resolver: zodResolver(phoneFixSchema),
    // A placeholder is not offered back for editing, as in the prototype.
    defaultValues: {
      phoneCell: isDummyPhone(patient.phoneCell) ? '' : showPhone(patient.phoneCell),
      phoneHome: isDummyPhone(patient.phoneHome) ? '' : showPhone(patient.phoneHome),
    },
  })
  return (
    <ResolveFrame
      exception={exception}
      title={`Fix phone — ${fullName(patient)}`}
      description="Placeholder numbers such as 000-000-0000 are flagged."
      formId={formId}
      busy={fix.busy}
      failure={fix.failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) =>
          fix.save({
            phone_cell: values.phoneCell === '' ? null : digits(values.phoneCell),
            phone_home: values.phoneHome === '' ? null : digits(values.phoneHome),
          })
        }
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
  const fix = usePatientFix(patient, onDone)
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
      busy={fix.busy}
      failure={fix.failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) =>
          fix.save({ address: values.line1, city: values.city, state: values.state, zip_code: values.zip })
        }
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
  const fix = usePatientFix(patient, onDone)
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
      busy={fix.busy}
      failure={fix.failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) =>
          fix.save({
            first_name: values.firstName,
            middle_name: values.middleName === '' ? null : values.middleName,
            last_name: values.lastName,
            address: values.line1,
          })
        }
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

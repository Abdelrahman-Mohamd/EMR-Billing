import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RadioGroup } from '@/components/ui/Choice'
import { DateInput } from '@/components/ui/DateInput'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  useReferringPhysicians,
  useCorrectReferringPhysicianNpi,
  type ReferringPhysician,
} from '@/features/admin-referring-physicians'
import {
  usePatientRecords,
  useSetCaseInsuranceSubscriber,
  useUpdatePatientCaseFields,
  type Coverage,
  type PatientCase,
} from '@/features/patients'
import { userMessage } from '@/lib/api/api-error'
import { todayIso } from '@/lib/utils/dates'
import { isValidNpi } from '@/lib/validation/npi'
import type { BillingException } from '../../model/billing-exception'
import {
  caseFixSchema,
  referrerFixSchema,
  subscriberFixSchema,
  type CaseFixValues,
  type ReferrerFixValues,
  type SubscriberFixValues,
} from '../../schemas/resolve-forms'
import { ResolveFrame } from './ResolveFrame'

/** The practice's referring physicians a claim can carry: a real NPI. */
function useValidReferrers(practiceId: number | undefined): ReferringPhysician[] {
  const referrers = useReferringPhysicians()
  return (referrers.data ?? []).filter((item) => item.practiceId === practiceId && isValidNpi(item.npi))
}

/**
 * "Complete case fields": the injury date or referring physician is missing.
 * What is filled in is saved on the server — those fields alone; nothing is
 * cleared. (The prototype's employment status is not in the case contract.)
 */
export function CaseFix({
  exception,
  item,
  missing,
  onDone,
  onClose,
}: {
  exception: BillingException
  item: PatientCase
  missing: 'injuryDate' | 'referrer'
  onDone: (label: string) => void
  onClose: () => void
}) {
  const formId = useId()
  const records = usePatientRecords()
  const update = useUpdatePatientCaseFields()
  const [failure, setFailure] = useState<string | null>(null)
  const practiceId = records.patients.find((patient) => patient.id === item.patientId)?.practiceId
  const referrers = useValidReferrers(practiceId)
  const form = useForm<CaseFixValues>({
    resolver: zodResolver(caseFixSchema(missing)),
    defaultValues: {
      injuryDate: item.injuryDate,
      referrerId: item.referrerId === null ? null : String(item.referrerId),
    },
  })
  return (
    <ResolveFrame
      exception={exception}
      title={`Complete case fields — ${item.name}`}
      description="Claims are held when the injury date or subscriber details are missing."
      formId={formId}
      busy={update.isPending}
      failure={failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          try {
            // As the prototype: what is filled in is saved; nothing is cleared.
            await update.mutateAsync({
              id: item.id,
              fields: {
                ...(values.injuryDate === '' ? {} : { injury_date: values.injuryDate }),
                ...(values.referrerId === null ? {} : { referring_physician_id: Number(values.referrerId) }),
              },
            })
            onDone('Case updated')
          } catch (error) {
            setFailure(userMessage(error))
          }
        }}
      >
        <FormGrid>
          <FormField
            name="injuryDate"
            label="Injury / onset date"
            required={missing === 'injuryDate'}
            span={6}
          >
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                max={todayIso()}
              />
            )}
          </FormField>
          <FormField
            name="referrerId"
            label="Referring physician"
            required={missing === 'referrer'}
            span={12}
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={referrers.map((referrer) => ({
                  value: String(referrer.id),
                  label: `${referrer.name} · NPI ${referrer.npi}`,
                }))}
                placeholder="Select a referring physician"
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}

/**
 * "Complete subscriber details": the primary insurance's subscriber has no
 * name or date of birth. Saved on the case's insurance — the subscriber alone,
 * keeping its relationship and gender.
 */
export function SubscriberFix({
  exception,
  coverage,
  onDone,
  onClose,
}: {
  exception: BillingException
  coverage: Coverage
  onDone: (label: string) => void
  onClose: () => void
}) {
  const formId = useId()
  const update = useSetCaseInsuranceSubscriber()
  const [failure, setFailure] = useState<string | null>(null)
  const subscriber = coverage.subscriber
  const form = useForm<SubscriberFixValues>({
    resolver: zodResolver(subscriberFixSchema),
    defaultValues: {
      firstName: subscriber?.firstName ?? '',
      lastName: subscriber?.lastName ?? '',
      dob: subscriber?.dob ?? '',
    },
  })
  return (
    <ResolveFrame
      exception={exception}
      title="Complete subscriber details"
      description="Primary insurance subscriber details are required when the patient is not the subscriber."
      formId={formId}
      busy={update.isPending}
      failure={failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          try {
            await update.mutateAsync({
              id: coverage.id,
              subscriber: {
                first_name: values.firstName,
                last_name: values.lastName,
                date_of_birth: values.dob,
                // What the record already says about them stays.
                relationship: subscriber?.relationship || 'Other',
                gender: subscriber === null || subscriber.gender === '' ? null : subscriber.gender,
              },
            })
            onDone('Subscriber completed')
          } catch (error) {
            setFailure(userMessage(error))
          }
        }}
      >
        <FormGrid>
          <FormField name="firstName" label="First name" required span={6}>
            {(field) => <Input {...field} placeholder="Enter first name" autoComplete="off" />}
          </FormField>
          <FormField name="lastName" label="Last name" required span={6}>
            {(field) => <Input {...field} placeholder="Enter last name" autoComplete="off" />}
          </FormField>
          <FormField name="dob" label="Subscriber DOB" required span={6}>
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                max={todayIso()}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}

/**
 * "Fix referring physician": the case's referring physician carries a dummy
 * NPI. Correct it on the directory profile (every case using the physician is
 * fixed), or give this case another physician.
 */
export function ReferrerFix({
  exception,
  referrer,
  item,
  onDone,
  onClose,
}: {
  exception: BillingException
  referrer: ReferringPhysician
  item: PatientCase
  /** `everyCase`: the directory was corrected, so every case using the physician is fixed. */
  onDone: (label: string, everyCase: boolean) => void
  onClose: () => void
}) {
  const formId = useId()
  const swap = useUpdatePatientCaseFields()
  const update = useCorrectReferringPhysicianNpi()
  const referrers = useValidReferrers(referrer.practiceId)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ReferrerFixValues>({
    resolver: zodResolver(referrerFixSchema),
    defaultValues: { mode: 'npi', npi: '', referrerId: null },
  })
  const mode = useWatch({ control: form.control, name: 'mode' })

  return (
    <ResolveFrame
      exception={exception}
      title={`Fix referring physician — ${referrer.name}`}
      description="Placeholder NPIs such as 9999999999 and 1234567890 are flagged. Correct the NPI on the directory profile, or point the case to another physician."
      formId={formId}
      busy={update.isPending || swap.isPending}
      failure={failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          try {
            if (values.mode === 'swap') {
              // The case's physician alone, on the server.
              await swap.mutateAsync({
                id: item.id,
                fields: { referring_physician_id: Number(values.referrerId) },
              })
              onDone('Referring physician fixed', false)
              return
            }
            // The NPI alone: the rest of the profile stays as it is.
            await update.mutateAsync({ id: referrer.id, npi: values.npi })
            onDone('Referring physician fixed', true)
          } catch (error) {
            setFailure(userMessage(error))
          }
        }}
      >
        <FormGrid>
          <FormField name="mode" label="How to fix it" required asFieldset span={12}>
            {(field) => (
              <RadioGroup
                name={field.name}
                value={field.value === 'npi' ? 'npi' : field.value === 'swap' ? 'swap' : undefined}
                onValueChange={field.onChange}
                options={[
                  {
                    value: 'npi',
                    label: `Correct ${referrer.name}’s NPI`,
                    description: 'Updates the referring physician directory for every case.',
                  },
                  { value: 'swap', label: 'Use a different referring physician on this case' },
                ]}
              />
            )}
          </FormField>
          <FormField name="npi" label="Correct NPI" required={mode === 'npi'} span={6}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter NPI"
                maxLength={10}
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField name="referrerId" label="Referring physician" required={mode === 'swap'} span={6}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={referrers.map((other) => ({ value: String(other.id), label: other.name }))}
                placeholder="Select a referring physician"
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}

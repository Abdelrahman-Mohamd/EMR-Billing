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
  useUpdateReferringPhysician,
  type ReferringPhysician,
} from '@/features/admin-referring-physicians'
import { usePatientRecords, type Coverage, type PatientCase } from '@/features/patients'
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

/** The case as the store takes it back: everything but its ids and diagnoses. */
function caseValuesOf(item: PatientCase) {
  const { id: _id, patientId: _patientId, diagnoses: _diagnoses, ...values } = item
  return values
}

/** The practice's referring physicians a claim can carry: a real NPI. */
function useValidReferrers(practiceId: number | undefined): ReferringPhysician[] {
  const referrers = useReferringPhysicians()
  return (referrers.data ?? []).filter((item) => item.practiceId === practiceId && isValidNpi(item.npi))
}

/** "Complete case fields": the injury date, employment status or referring physician is missing. */
export function CaseFix({
  exception,
  item,
  missing,
  onDone,
  onClose,
}: {
  exception: BillingException
  item: PatientCase
  missing: 'injuryDate' | 'employmentStatus' | 'referrer'
  onDone: (label: string) => void
  onClose: () => void
}) {
  const formId = useId()
  const records = usePatientRecords()
  const practiceId = records.patients.find((patient) => patient.id === item.patientId)?.practiceId
  const referrers = useValidReferrers(practiceId)
  const form = useForm<CaseFixValues>({
    resolver: zodResolver(caseFixSchema(missing)),
    defaultValues: {
      injuryDate: item.injuryDate,
      employmentStatus: item.employmentStatus,
      referrerId: item.referrerId === null ? null : String(item.referrerId),
    },
  })
  return (
    <ResolveFrame
      exception={exception}
      title={`Complete case fields — ${item.name}`}
      description="Claims are held when injury date, employment status or subscriber details are missing."
      formId={formId}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          // As the prototype: what is filled in is saved; nothing is cleared.
          records.updateCase(item.id, {
            ...caseValuesOf(item),
            ...(values.injuryDate === '' ? {} : { injuryDate: values.injuryDate }),
            ...(values.employmentStatus === '' ? {} : { employmentStatus: values.employmentStatus }),
            ...(values.referrerId === null ? {} : { referrerId: Number(values.referrerId) }),
          })
          onDone('Case updated')
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
            name="employmentStatus"
            label="Employment status"
            required={missing === 'employmentStatus'}
            span={6}
          >
            {(field) => (
              <Input {...field} placeholder="Enter status, e.g. Employed full time" autoComplete="off" />
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

/** "Complete subscriber details": the primary insurance's subscriber has no name or date of birth. */
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
  const records = usePatientRecords()
  const form = useForm<SubscriberFixValues>({
    resolver: zodResolver(subscriberFixSchema),
    defaultValues: { name: coverage.subscriber?.name ?? '', dob: coverage.subscriber?.dob ?? '' },
  })
  return (
    <ResolveFrame
      exception={exception}
      title="Complete subscriber details"
      description="Primary insurance subscriber details are required when the patient is not the subscriber."
      formId={formId}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          const { id: _id, patientId: _patientId, ...rest } = coverage
          records.updateCoverage(coverage.id, {
            ...rest,
            subscriber: { relationship: coverage.subscriber?.relationship ?? '', ...values },
          })
          onDone('Subscriber completed')
        }}
      >
        <FormGrid>
          <FormField name="name" label="Subscriber name" required span={6}>
            {(field) => <Input {...field} placeholder="Enter subscriber name" autoComplete="off" />}
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
  const records = usePatientRecords()
  const update = useUpdateReferringPhysician()
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
      busy={update.isPending}
      failure={failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          if (values.mode === 'swap') {
            records.updateCase(item.id, { ...caseValuesOf(item), referrerId: Number(values.referrerId) })
            onDone('Referring physician fixed', false)
            return
          }
          try {
            await update.mutateAsync({
              id: referrer.id,
              values: {
                practiceId: String(referrer.practiceId),
                code: referrer.code,
                name: referrer.name,
                type: referrer.type,
                npi: values.npi,
              },
            })
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

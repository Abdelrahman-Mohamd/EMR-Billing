import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/Form'
import { MultiSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { formatIsoDate } from '@/lib/utils/dates'
import type { VisitReferences } from '../queries/use-visit-references'

/**
 * A visit's own fields — date of service, location, billing and treating
 * providers, authorization, diagnoses — for a new visit and for a visit's
 * save. The case decides what is offered: its practice's active locations and
 * providers, its authorizations, its diagnoses (and, on a saved visit, the
 * codes it already has). Without a case, the pickers wait for one.
 */
export function VisitFields({
  refs,
  caseId,
  today,
  disabled,
  savedCodes = [],
  onDiagnosesChange,
}: {
  refs: VisitReferences
  caseId: string | null
  today: string
  disabled: boolean
  /** A saved visit's own codes: offered even when no longer on the case. */
  savedCodes?: readonly string[]
  /** After the diagnoses change — a new visit's lines point at them. */
  onDiagnosesChange?: (codes: string[]) => void
}) {
  const { records } = refs
  const chosenCase = records.cases.find((item) => item.id === caseId)
  const practiceId = records.patients.find((item) => item.id === chosenCase?.patientId)?.practiceId
  const locations = refs.locationsOf(practiceId).filter((location) => location.isActive)
  const providers = refs.providers
    .filter((provider) => provider.practiceId === practiceId && provider.isActive)
    .map((provider) => ({ value: String(provider.id), label: refs.providerName(provider.id) }))
  const authorizations = records.authorizations.filter((auth) => auth.caseId === chosenCase?.id)
  const caseDiagnoses = chosenCase?.diagnoses ?? []
  const diagnosisOptions = [
    ...caseDiagnoses.map((diagnosis) => ({
      value: diagnosis.code,
      label: diagnosis.description === '' ? diagnosis.code : `${diagnosis.code} — ${diagnosis.description}`,
    })),
    ...savedCodes
      .filter((code) => !caseDiagnoses.some((diagnosis) => diagnosis.code === code))
      .map((code) => ({ value: code, label: code })),
  ]

  const pick = (
    name: 'locationId' | 'billingProviderId' | 'treatingProviderId',
    label: string,
    options: Array<{ value: string; label: string }>,
    placeholder: string,
  ) => (
    <FormField name={name} label={label} required span={6}>
      {(field) => (
        <Select
          value={typeof field.value === 'string' ? field.value : null}
          onChange={field.onChange}
          options={options}
          placeholder={chosenCase === undefined ? 'Select a case first' : placeholder}
          disabled={chosenCase === undefined || disabled}
        />
      )}
    </FormField>
  )

  return (
    <>
      <FormField
        name="dateOfService"
        label="Date of service"
        required
        span={6}
        info="On or before today. A case has one visit a day."
      >
        {(field) => (
          <DateInput
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            max={today}
            disabled={disabled}
          />
        )}
      </FormField>
      {pick(
        'locationId',
        'Location',
        locations.map((location) => ({ value: String(location.id), label: location.name })),
        'Select a location',
      )}
      {pick('billingProviderId', 'Billing provider', providers, 'Select the billing provider')}
      {pick('treatingProviderId', 'Treating provider', providers, 'Select the treating provider')}
      <FormField
        name="authorizationId"
        label="Authorization"
        span={6}
        info="One of the case’s insurances’ authorizations. It is used when the visit is released."
      >
        {(field) => (
          <Select
            value={typeof field.value === 'string' ? field.value : null}
            onChange={field.onChange}
            options={authorizations.map((auth) => ({
              value: auth.id,
              label: `${auth.number} · ${formatIsoDate(auth.start)} – ${formatIsoDate(auth.end)}`,
            }))}
            placeholder={chosenCase === undefined ? 'Select a case first' : 'None'}
            disabled={chosenCase === undefined || disabled}
            clearable
          />
        )}
      </FormField>
      <FormField
        name="diagnosisCodes"
        label="Diagnoses"
        span={12}
        info="The ICD-10 codes this visit bills, up to 12, in the order chosen: the position is the pointer its charge lines name. A new visit starts with its case’s."
      >
        {(field) => (
          <MultiSelect
            value={Array.isArray(field.value) ? (field.value as string[]) : []}
            onChange={(next) => {
              field.onChange(next)
              onDiagnosesChange?.(next)
            }}
            options={diagnosisOptions}
            placeholder={chosenCase === undefined ? 'Select a case first' : 'Select diagnoses'}
            searchPlaceholder="Search diagnoses"
            emptyMessage="The case has no diagnoses."
            disabled={chosenCase === undefined || disabled}
          />
        )}
      </FormField>
    </>
  )
}

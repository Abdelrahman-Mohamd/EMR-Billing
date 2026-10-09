import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/Form'
import { Select } from '@/components/ui/Select'
import { formatIsoDate } from '@/lib/utils/dates'
import type { VisitReferences } from '../queries/use-visit-references'

/**
 * A visit's own fields — date of service, location, billing and treating
 * providers, authorization — for a new visit and for a visit's save. The case
 * decides what is offered: its practice's active locations and providers, its
 * authorizations. Without a case, the pickers wait for one.
 */
export function VisitFields({
  refs,
  caseId,
  today,
  disabled,
}: {
  refs: VisitReferences
  caseId: string | null
  today: string
  disabled: boolean
}) {
  const { records } = refs
  const chosenCase = records.cases.find((item) => item.id === caseId)
  const practiceId = records.patients.find((item) => item.id === chosenCase?.patientId)?.practiceId
  const locations = refs.locationsOf(practiceId).filter((location) => location.isActive)
  const providers = refs.providers
    .filter((provider) => provider.practiceId === practiceId && provider.isActive)
    .map((provider) => ({ value: String(provider.id), label: refs.providerName(provider.id) }))
  const authorizations = records.authorizations.filter((auth) => auth.caseId === chosenCase?.id)

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
    </>
  )
}

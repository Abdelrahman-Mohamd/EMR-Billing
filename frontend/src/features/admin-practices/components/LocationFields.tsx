import { FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { placeOfServiceOptions } from '../model/place-of-service'
import { AddressFields } from './AddressFields'

/**
 * A location's own fields, in the prototype's order: name and code, the
 * rendering address, NPI and place of service. Used by "Add location" (at the
 * top level of its form) and by "New practice" (under `location`).
 */
export function LocationFields({
  nested = false,
  readOnly = false,
}: {
  /** The fields sit under `location.` in the new-practice form. */
  nested?: boolean
  readOnly?: boolean
}) {
  const path = nested ? 'location.' : ''
  return (
    <>
      <FormField name={`${path}name`} label="Location name" required span={8}>
        {(field) => (
          <Input {...field} placeholder="Enter location name" autoComplete="off" readOnly={readOnly} />
        )}
      </FormField>
      <FormField
        name={`${path}code`}
        label="Location code"
        required
        span={4}
        // V2 §10.2: a location code is unique within its practice.
        info="A short code for this location. No two locations of a practice can share one."
      >
        {(field) => (
          <Input {...field} placeholder="Enter location code" autoComplete="off" readOnly={readOnly} />
        )}
      </FormField>
      <AddressFields
        prefix={nested ? 'location.address' : 'address'}
        line1Label="Rendering address"
        readOnly={readOnly}
      />
      <FormField name={`${path}npi`} label="Facility or group NPI" required span={6}>
        {(field) => (
          <Input
            {...field}
            placeholder="Enter NPI"
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
            readOnly={readOnly}
          />
        )}
      </FormField>
      <FormField
        name={`${path}placeOfService`}
        label="Default place of service"
        span={6}
        // PRD V2 BR47: a charge line's place of service defaults from its location.
        // The allowed codes are not confirmed yet (Q-079); see model/place-of-service.ts.
        info="Charge lines from this location start with this place of service."
      >
        {(field) => (
          <Select
            value={typeof field.value === 'string' ? field.value : null}
            onChange={field.onChange}
            options={placeOfServiceOptions(typeof field.value === 'string' ? field.value : null)}
            placeholder="Select place of service"
            clearable
            disabled={readOnly}
          />
        )}
      </FormField>
    </>
  )
}

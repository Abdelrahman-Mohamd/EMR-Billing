import { FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'

/**
 * The address block both forms share, bound to a nested `address` object —
 * `address.line1`, `location.address.city` — so form values keep the payload's
 * shape. `withLine2` adds the suite line, which only the practice payload has.
 */
export function AddressFields({
  prefix,
  line1Label,
  withLine2 = false,
  readOnly = false,
}: {
  /** Where the address sits in the form values: `address` or `location.address`. */
  prefix: 'address' | 'location.address'
  line1Label: string
  withLine2?: boolean
  readOnly?: boolean
}) {
  return (
    <>
      <FormField name={`${prefix}.line1`} label={line1Label} required span={withLine2 ? 8 : 12}>
        {(field) => (
          <Input {...field} placeholder="Enter street address" autoComplete="off" readOnly={readOnly} />
        )}
      </FormField>
      {withLine2 && (
        <FormField name={`${prefix}.line2`} label="Suite" span={4}>
          {(field) => (
            <Input {...field} placeholder="Enter suite or unit" autoComplete="off" readOnly={readOnly} />
          )}
        </FormField>
      )}
      <FormField name={`${prefix}.city`} label="City" required span={6}>
        {(field) => <Input {...field} placeholder="Enter city" autoComplete="off" readOnly={readOnly} />}
      </FormField>
      <FormField name={`${prefix}.state`} label="State" required span={3}>
        {(field) => (
          <Input
            {...field}
            // Shown as it will be saved: a two-letter code in capitals.
            onChange={(event) => field.onChange(event.target.value.toUpperCase())}
            placeholder="Enter state"
            maxLength={2}
            autoCapitalize="characters"
            autoComplete="off"
            readOnly={readOnly}
          />
        )}
      </FormField>
      <FormField name={`${prefix}.zip`} label="ZIP" required span={3}>
        {(field) => (
          <Input
            {...field}
            placeholder="Enter ZIP code"
            inputMode="numeric"
            maxLength={5}
            autoComplete="off"
            readOnly={readOnly}
          />
        )}
      </FormField>
    </>
  )
}

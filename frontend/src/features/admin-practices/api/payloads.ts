import type {
  LocationFieldsValues,
  LocationFormValues,
  NewPracticeFormValues,
  PracticeFormValues,
} from '../schemas/practice-form'
import type {
  AddressPayload,
  LocationPayload,
  LocationUpdatePayload,
  PracticeLocationPayload,
  PracticePayload,
} from '../schemas/practice-payload'

/**
 * Form values → request bodies. The only code that knows both shapes on the
 * way out; its tests pin the result against the example payloads.
 */
function toAddressPayload(address: {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
}) {
  const payload: AddressPayload = {
    line1: address.line1,
    city: address.city,
    state: address.state,
    zip: address.zip,
  }
  // Left out when empty, as in the examples.
  if (address.line2 !== undefined && address.line2 !== '') payload.line2 = address.line2
  return payload
}

/** A new practice's location, in the flat shape `POST /practices` takes. */
function toPracticeLocationPayload(location: LocationFieldsValues): PracticeLocationPayload {
  const payload: PracticeLocationPayload = {
    code: location.code,
    name: location.name,
    npi: location.npi,
    address: location.address.line1,
    city: location.address.city,
    state: location.address.state,
    zipcode: location.address.zip,
  }
  if (location.placeOfService !== null) payload.place_of_service = location.placeOfService
  return payload
}

export function toPracticePayload(values: PracticeFormValues | NewPracticeFormValues): PracticePayload {
  const payload: PracticePayload = {
    // No organization is sent as null — an assumption until the contract says
    // how "none" (and removing one on edit) is written.
    organization_id: values.organizationId === null ? null : Number(values.organizationId),
    code: values.code,
    name: values.name,
    npi: values.npi,
    tax_id: values.taxId,
    taxonomy_code: values.taxonomyCode,
    address: toAddressPayload(values.address),
    is_active: values.isActive,
  }
  if ('location' in values) {
    // A new practice: an empty DBA is left out, as in the example.
    if (values.dbaName !== '') payload.dba_name = values.dbaName
    payload.locations = [toPracticeLocationPayload(values.location)]
  } else {
    // A save keeps whatever it leaves out, so an emptied DBA is sent as null.
    payload.dba_name = values.dbaName === '' ? null : values.dbaName
  }
  return payload
}

/** A location saved on its own (`PUT /locations/{id}`): every field, no `practice_id`. */
export function toLocationUpdatePayload(values: LocationFormValues): LocationUpdatePayload {
  return { ...toPracticeLocationPayload(values), is_active: values.isActive }
}

/** A location added to a practice (`POST /locations`). */
export function toLocationPayload(practiceId: number, values: LocationFormValues): LocationPayload {
  return { practice_id: practiceId, ...toLocationUpdatePayload(values) }
}

/** Practice payload keys whose form field is named differently. */
const PRACTICE_FIELD_FOR: Readonly<Record<string, string>> = {
  organization_id: 'organizationId',
  dba_name: 'dbaName',
  tax_id: 'taxId',
  taxonomy_code: 'taxonomyCode',
}

/** A flat location key → where a location form keeps it. */
const LOCATION_FIELD_FOR: Readonly<Record<string, string>> = {
  address: 'address.line1',
  city: 'address.city',
  state: 'address.state',
  zipcode: 'address.zip',
  place_of_service: 'placeOfService',
  is_active: 'isActive',
}

/** A location form's server field error path: `zipcode` → `address.zip`. */
export function locationFormFieldFor(path: string): string {
  const [field = '', ...rest] = path.split('.')
  return [LOCATION_FIELD_FOR[field] ?? field, ...rest].join('.')
}

/**
 * A server field error's path (payload names) → the form field it belongs to,
 * so a rejection lands on its input: `tax_id` → `taxId`; the practice's
 * nested address keys are the form's. A new practice's first location, sent
 * flat as `locations[0]`, is the form's `location`, its address nested:
 * `locations.0.zipcode` → `location.address.zip`.
 */
export function practiceFormFieldFor(path: string): string {
  const [head, index, field, ...rest] = path.split('.')
  if (head === 'locations' && index === '0' && field !== undefined)
    return ['location', LOCATION_FIELD_FOR[field] ?? field, ...rest].join('.')
  return path
    .split('.')
    .map((part) => PRACTICE_FIELD_FOR[part] ?? part)
    .join('.')
}

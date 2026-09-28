import type {
  LocationFieldsValues,
  LocationFormValues,
  NewPracticeFormValues,
  PracticeFormValues,
} from '../schemas/practice-form'
import type {
  AddressPayload,
  LocationPayload,
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

function toPracticeLocationPayload(location: LocationFieldsValues): PracticeLocationPayload {
  const payload: PracticeLocationPayload = {
    code: location.code,
    name: location.name,
    npi: location.npi,
    address: toAddressPayload(location.address),
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
  if (values.dbaName !== '') payload.dba_name = values.dbaName
  if ('location' in values) payload.locations = [toPracticeLocationPayload(values.location)]
  return payload
}

export function toLocationPayload(practiceId: number, values: LocationFormValues): LocationPayload {
  return { practice_id: practiceId, ...toPracticeLocationPayload(values), is_active: values.isActive }
}

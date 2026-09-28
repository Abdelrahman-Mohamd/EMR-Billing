import type { LocationFormValues } from '../schemas/practice-form'
import type { Location } from '../schemas/practice'

/**
 * A saved location as location-form values: what the edit dialog starts from,
 * and what the row's Deactivate / Reactivate sends back with only `isActive`
 * changed — there is no separate status endpoint, so a status change is a
 * normal location update.
 */
export function locationToFormValues(location: Location): LocationFormValues {
  return {
    code: location.code,
    name: location.name,
    npi: location.npi,
    address: {
      line1: location.address.line1,
      city: location.address.city,
      state: location.address.state,
      zip: location.address.zip,
    },
    placeOfService: location.placeOfService ?? null,
    isActive: location.isActive,
  }
}

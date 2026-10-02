import { useSyncExternalStore } from 'react'
import { notLinked, type BillingElection, type LocationIntegration, type Payload } from '../model/integration'

/**
 * WHERE EMR INTEGRATION LIVES FOR NOW — a temporary, in-memory store in this
 * browser tab. **There is no backend for EMR integration**, so nothing here
 * calls a server or the EMR, and nothing pretends to: no endpoint, payload or
 * request. This is architecture only; the screen shows no message about it.
 *
 * - **Locations' integration** (request → link → election) changes here and
 *   lasts until the page reloads. Changing it talks to no EMR.
 * - **The payload log** is read-only: payloads come from the EMR through the
 *   backend, which does not exist, so outside development it stays empty and
 *   the screen shows the prototype's "No payloads".
 * - In development and tests it starts with the prototype's states and log
 *   (`sample-integration.ts`, loaded only when `__MOCK_DATA__` is true, so a
 *   production build never contains them).
 * - The screens only use `useEmrIntegration()`. When a backend exists, that
 *   hook is replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5)
 *   and this file is deleted — the screens do not change.
 * - Nothing here enforces who may request, approve or elect: the server
 *   decides that on every request (docs/SECURITY.md §1).
 *
 * Same pattern as the roles, procedure codes and fee schedules stores.
 */
interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  /** By location id; a location with no entry is not linked. */
  integrations: Readonly<Record<number, LocationIntegration>>
  /** Newest first. */
  payloads: readonly Payload[]
}

let snapshot: Snapshot = { ready: !__MOCK_DATA__, integrations: {}, payloads: [] }
const listeners = new Set<() => void>()

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-integration').then(({ SAMPLE_INTEGRATIONS, SAMPLE_PAYLOADS }) => {
    if (snapshot.ready) return
    publish({
      ready: true,
      // Anything changed while the sample loaded wins.
      integrations: {
        ...Object.fromEntries(SAMPLE_INTEGRATIONS.map((item) => [item.locationId, item])),
        ...snapshot.integrations,
      },
      payloads: [...SAMPLE_PAYLOADS],
    })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function change(locationId: number, update: (item: LocationIntegration) => LocationIntegration): void {
  publish({
    ...snapshot,
    integrations: {
      ...snapshot.integrations,
      [locationId]: update(snapshot.integrations[locationId] ?? notLinked(locationId)),
    },
  })
}

export interface EmrIntegrationSource {
  ready: boolean
  /** A location's integration; not linked when nothing was done for it. */
  integrationOf: (locationId: number) => LocationIntegration
  /** The location already holding this Unique Location ID, if any: an id maps one location. */
  uniqueIdOwner: (uniqueLocationId: string) => number | undefined
  payloads: readonly Payload[]
  request: (
    locationId: number,
    request: { uniqueLocationId: string; note: string; requestedBy: string | null; requestedOn: string },
  ) => void
  approve: (locationId: number, linkedOn: string) => void
  elect: (locationId: number, election: BillingElection) => void
}

export function useEmrIntegration(): EmrIntegrationSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ready: current.ready,
    payloads: current.payloads,
    integrationOf: (locationId) => current.integrations[locationId] ?? notLinked(locationId),
    uniqueIdOwner: (uniqueLocationId) =>
      Object.values(current.integrations).find(
        (item) => item.uniqueLocationId !== '' && item.uniqueLocationId === uniqueLocationId,
      )?.locationId,
    request: (locationId, request) =>
      change(locationId, (item) => ({ ...item, ...request, link: 'Requested' })),
    approve: (locationId, linkedOn) => change(locationId, (item) => ({ ...item, link: 'Linked', linkedOn })),
    elect: (locationId, election) => change(locationId, (item) => ({ ...item, election })),
  }
}

/** Tests only: start from a known state. */
export function resetEmrIntegration(
  integrations: readonly LocationIntegration[],
  payloads: readonly Payload[] = [],
): void {
  publish({
    ready: true,
    integrations: Object.fromEntries(integrations.map((item) => [item.locationId, { ...item }])),
    payloads: [...payloads],
  })
}

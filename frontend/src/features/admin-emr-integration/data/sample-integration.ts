import { notLinked, type LocationIntegration, type Payload } from '../model/integration'

/**
 * TEMPORARY DEVELOPMENT DATA — not records from any system; the patients are
 * the prototype's invented ones.
 *
 * The prototype's integration states and payload log, so the screen can be
 * seen with content in development and tests. They point at the development
 * practices mock's location ids (1 Bay Ridge, 2 Park Slope, 3 Staten Island
 * Annex, 4 Northgate Main — the prototype's L1–L4). Times are relative to now,
 * so "Today" and "Yesterday" can be seen. Loaded only when `__MOCK_DATA__` is
 * true (see `integration-store.ts`), so a production build never contains it.
 */
const isoDaysAgo = (days: number) => {
  const day = new Date()
  day.setDate(day.getDate() - days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}
const at = (days: number, time: string) => `${isoDaysAgo(days)}T${time}:00`

export const SAMPLE_INTEGRATIONS: readonly LocationIntegration[] = [
  {
    ...notLinked(1),
    uniqueLocationId: 'EMR-LOC-4471',
    link: 'Linked',
    election: 'Integrated',
    linkedOn: '2025-11-03',
  },
  {
    ...notLinked(2),
    uniqueLocationId: 'EMR-LOC-4472',
    link: 'Linked',
    election: 'Integrated',
    linkedOn: '2025-11-03',
  },
  {
    ...notLinked(3),
    uniqueLocationId: 'EMR-LOC-4480',
    link: 'Requested',
    requestedBy: 'Ivy Bennett',
    requestedOn: isoDaysAgo(4),
  },
  {
    ...notLinked(4),
    uniqueLocationId: 'EMR-LOC-5120',
    link: 'Linked',
    election: 'Integrated',
    linkedOn: '2026-02-17',
  },
]

const payload = (
  id: number,
  stamp: string,
  locationId: number,
  recordId: string,
  patient: string,
  result: Payload['result'],
  detail: string,
): Payload => ({ id: `sample-${id}`, at: stamp, locationId, recordId, patient, result, detail })

export const SAMPLE_PAYLOADS: readonly Payload[] = [
  payload(1, at(0, '08:30'), 1, 'EMR-N-5590402', 'Kevin O’Brien', 'Accepted', 'New record → Charge Review.'),
  payload(
    2,
    at(0, '08:20'),
    2,
    'EMR-N-5590388',
    'Maria Gonzalez',
    'Accepted',
    'New record → Pended (no authorization available).',
  ),
  payload(3, at(0, '08:12'), 1, 'EMR-N-5590371', 'Beatrice Nwosu', 'Accepted', 'New record → Charge Review.'),
  payload(
    4,
    at(0, '08:05'),
    1,
    'EMR-N-5590366',
    'Aaliyah Johnson',
    'Accepted',
    'New record → Charge Review.',
  ),
  payload(
    5,
    at(1, '19:02'),
    1,
    'EMR-N-5590310',
    'Sophia Russo',
    'Updated queue',
    'Matches a submitted claim — stored in the Updated Charges queue.',
  ),
  payload(
    6,
    at(1, '18:10'),
    3,
    'EMR-N-5590298',
    'Walk-in (Staten Island)',
    'Blocked',
    'Staten Island Annex is EMR-only — payload not accepted into billing.',
  ),
  payload(
    7,
    at(1, '17:25'),
    1,
    'EMR-N-5590290',
    'Thomas Reilly',
    'Accepted',
    'New record → Billing Exceptions ($0.00 CPT 97033).',
  ),
  payload(
    8,
    at(1, '16:10'),
    2,
    'EMR-N-5590271',
    'Hannah Levi',
    'Accepted',
    'New record → Incomplete Profiles bucket (unknown provider).',
  ),
  payload(
    9,
    at(7, '18:40'),
    1,
    'EMR-N-5590911',
    'Aaliyah Johnson',
    'Replaced',
    'Re-sent note replaced the earlier version; old record moved to Inactive Records.',
  ),
]

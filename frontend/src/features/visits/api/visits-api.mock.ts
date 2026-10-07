import { ApiError } from '@/lib/api/api-error'
import type { ChargeLineFields, CreateVisitPayload, RecordRef } from '../schemas/visit'
import type { VisitsApi } from './visits-api'

/**
 * In-memory visits for development and demos (ADR 0006). Never part of a
 * production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the real payloads and answers in the
 * assumed wire format (payload + `id`; each line + `id`, `visit_id`). It
 * enforces nothing the examples do not show — the visit a line is added to must
 * exist, and that is all. It calculates nothing: no price, no status.
 *
 * Invented data only: a few visits on the patients sample's cases (practice 1),
 * at the practices mock's Bay Ridge (1) and Park Slope (2), with the providers
 * mock's clinicians and the procedure codes sample's codes.
 */
type LineRecord = ChargeLineFields & { id: number; visit_id: number }
type VisitRecord = Omit<CreateVisitPayload, 'charge_lines'> & { id: number; charge_lines: LineRecord[] }

const LATENCY_MS = 250

let nextVisitId = 1
let nextLineId = 1

function record(payload: CreateVisitPayload): VisitRecord {
  const id = nextVisitId++
  return {
    ...payload,
    id,
    charge_lines: payload.charge_lines.map((line) => ({ ...line, id: nextLineId++, visit_id: id })),
  }
}

const line = (
  code: RecordRef,
  units: number,
  modifiers?: string[],
  pointers?: number[],
): ChargeLineFields => ({
  procedure_code_id: code,
  units,
  ...(modifiers === undefined ? {} : { modifiers }),
  ...(pointers === undefined ? {} : { diagnosis_pointers: pointers }),
})

const visit = (
  caseId: string,
  date: string,
  locationId: number,
  treatingProviderId: number,
  lines: ChargeLineFields[],
  authorizationId: string | null = null,
): VisitRecord =>
  record({
    case_id: caseId,
    date_of_service: date,
    location_id: locationId,
    billing_provider_id: 1,
    treating_provider_id: treatingProviderId,
    authorization_id: authorizationId,
    charge_lines: lines,
  })

let visits: VisitRecord[] = [
  visit('p1-case', '2026-09-14', 1, 1, [
    line('97110', 2, ['GP'], [1]),
    line('97140', 1, ['GP', '59'], [1, 2]),
  ]),
  visit(
    'p4-case',
    '2026-09-15',
    1,
    2,
    [line('97110', 2, ['GP'], [1, 2]), line('97530', 1, ['GP'], [1])],
    'a2',
  ),
  visit('p3-case', '2026-09-12', 2, 3, [line('97162', 1, ['GP'], [1]), line('97110', 1)], 'a1'),
  visit('p14-case', '2026-09-14', 1, 1, [line('97110', 2, ['GP'], [1]), line('97033', 1, ['GP'], [1])]),
]

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))
const copy = (item: VisitRecord): VisitRecord => ({
  ...item,
  charge_lines: item.charge_lines.map((l) => ({ ...l })),
})

export const mockVisitsApi: VisitsApi = {
  async list() {
    await wait()
    return visits.map(copy)
  },
  async create(payload) {
    await wait()
    const created = record(payload)
    visits = [created, ...visits]
    return copy(created)
  },
  async addChargeLine({ visit_id: visitId, ...fields }) {
    await wait()
    const target = visits.find((item) => item.id === visitId)
    if (target === undefined)
      throw new ApiError({ kind: 'not_found', message: 'This visit could not be found.', status: 404 })
    const created: LineRecord = { ...fields, id: nextLineId++, visit_id: visitId }
    visits = visits.map((item) =>
      item.id === visitId ? { ...item, charge_lines: [...item.charge_lines, created] } : item,
    )
    return { ...created }
  },
}

import { z } from 'zod'
import { ApiError } from '@/lib/api/api-error'
import {
  chargeLineResponseSchema,
  visitResponseSchema,
  type ChargeLine,
  type CreateChargeLinePayload,
  type CreateVisitPayload,
  type Visit,
} from '../schemas/visit'

/**
 * Visits' and charge lines' only door to a server.
 *
 * **No endpoints exist yet.** The request bodies are known (the payload
 * examples for creating a visit and a charge line); paths, methods and
 * responses are not, so none are written. Until they exist, the calls reject
 * as `unavailable` and the screens show their load-failed state.
 *
 * Assumed until the contract says otherwise: one list of every visit the user
 * can see, with its charge lines, filtered on screen; creating a visit (with
 * its lines) and adding a line to a visit — and nothing else. No payload
 * exists for changing or removing a visit or a line, so neither is built.
 */
export interface VisitsApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: CreateVisitPayload) => Promise<unknown>
  addChargeLine: (payload: CreateChargeLinePayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Visits are not available right now.',
      detail:
        'No visit or charge-line endpoints exist yet. features/visits/api/visits-api.ts is the integration point.',
    }),
  )

const live: VisitsApi = { list: notConnected, create: notConnected, addChargeLine: notConnected }

function backend(): Promise<VisitsApi> {
  return Promise.resolve(live)
}

export async function listVisits(signal?: AbortSignal): Promise<Visit[]> {
  return z.array(visitResponseSchema).parse(await (await backend()).list(signal))
}

export async function createVisit(payload: CreateVisitPayload): Promise<Visit> {
  return visitResponseSchema.parse(await (await backend()).create(payload))
}

export async function addChargeLine(payload: CreateChargeLinePayload): Promise<ChargeLine> {
  return chargeLineResponseSchema.parse(await (await backend()).addChargeLine(payload))
}

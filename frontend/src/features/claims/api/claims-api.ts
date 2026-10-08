import { z } from 'zod'
import { ApiError } from '@/lib/api/api-error'
import { claimResponseSchema, type Claim, type CreateClaimPayload } from '../schemas/claim'

/**
 * Claims' only door to a server.
 *
 * **No endpoints exist yet.** The request body is known (the claim payload
 * example); paths, methods and responses are not, so none are written. Until
 * they exist, the calls reject as `unavailable` and the screens show their
 * load-failed state.
 *
 * Assumed until the contract says otherwise: one list of every claim the user
 * can see, filtered on screen, and creating one — nothing else. No payload
 * exists for submitting, correcting, voiding or deleting a claim, so none is
 * built.
 */
export interface ClaimsApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: CreateClaimPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Claims are not available right now.',
      detail: 'No claim endpoints exist yet. features/claims/api/claims-api.ts is the integration point.',
    }),
  )

const live: ClaimsApi = { list: notConnected, create: notConnected }

function backend(): Promise<ClaimsApi> {
  return Promise.resolve(live)
}

export async function listClaims(signal?: AbortSignal): Promise<Claim[]> {
  return z.array(claimResponseSchema).parse(await (await backend()).list(signal))
}

export async function createClaim(payload: CreateClaimPayload): Promise<Claim> {
  return claimResponseSchema.parse(await (await backend()).create(payload))
}

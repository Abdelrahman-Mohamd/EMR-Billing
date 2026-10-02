import { z } from 'zod'
import { ApiError, renameFieldErrors } from '@/lib/api/api-error'
import {
  RELEASE_BUCKET_FORM_FIELD_FOR,
  releaseBucketResponseSchema,
  toReleaseBucketPayload,
  type ReleaseBucket,
  type ReleaseBucketFormValues,
  type ReleaseBucketPayload,
} from '../schemas/release-bucket'

/**
 * Release buckets' only door to a server.
 *
 * **No endpoints exist yet.** The request body is known (the release bucket
 * payload); paths, methods and responses are not, so none are written. In
 * development and tests the calls go to an in-memory mock that plays the
 * server (ADR 0006); in any other build they reject as `unavailable`.
 *
 * Assumed until the contract says otherwise: one list of every bucket the user
 * can see, filtered on screen; create and update, and nothing else — the
 * prototype offers no delete, so none is built.
 */
export interface ReleaseBucketsApi {
  list: (signal?: AbortSignal) => Promise<unknown>
  create: (payload: ReleaseBucketPayload) => Promise<unknown>
  update: (id: number, payload: ReleaseBucketPayload) => Promise<unknown>
}

const notConnected = (): Promise<never> =>
  Promise.reject(
    new ApiError({
      kind: 'unavailable',
      message: 'Release buckets are not available right now.',
      detail:
        'No release bucket endpoints exist yet. features/admin-release-buckets/api/release-buckets-api.ts is the integration point.',
    }),
  )

const live: ReleaseBucketsApi = { list: notConnected, create: notConnected, update: notConnected }

async function backend(): Promise<ReleaseBucketsApi> {
  // Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
  if (__MOCK_DATA__) return (await import('./release-buckets-api.mock')).mockReleaseBucketsApi
  return live
}

async function save(call: (api: ReleaseBucketsApi) => Promise<unknown>): Promise<ReleaseBucket> {
  try {
    return releaseBucketResponseSchema.parse(await call(await backend()))
  } catch (error) {
    throw renameFieldErrors(error, RELEASE_BUCKET_FORM_FIELD_FOR)
  }
}

export async function listReleaseBuckets(signal?: AbortSignal): Promise<ReleaseBucket[]> {
  return z.array(releaseBucketResponseSchema).parse(await (await backend()).list(signal))
}

export function createReleaseBucket(values: ReleaseBucketFormValues): Promise<ReleaseBucket> {
  return save((api) => api.create(toReleaseBucketPayload(values)))
}

export function updateReleaseBucket(id: number, values: ReleaseBucketFormValues): Promise<ReleaseBucket> {
  return save((api) => api.update(id, toReleaseBucketPayload(values)))
}

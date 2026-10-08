import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import {
  RELEASE_BUCKET_FORM_FIELD_FOR,
  releaseBucketDetailResponseSchema,
  releaseBucketPageResponseSchema,
  toReleaseBucketPayload,
  toReleaseBucketUpdatePayload,
  type ReleaseBucket,
  type ReleaseBucketFormValues,
  type ReleaseBucketPayload,
  type ReleaseBucketUpdatePayload,
} from '../schemas/release-bucket'

/**
 * Release buckets' only door to a server. **Live** (contracts confirmed
 * 2026-10-07), carrying the session's token: `GET /release-buckets?page=N`,
 * `GET /release-buckets/{id}`, `POST /release-buckets`,
 * `PUT /release-buckets/{id}` and `DELETE /release-buckets/{id}`. Only `page`
 * is sent to the list. Writes resolve with the server's message, which the
 * screens show. Shapes in schemas/release-bucket.ts.
 */
export interface ReleaseBucketsApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ buckets: ReleaseBucket[]; pageCount: number }>
  get: (id: number, signal?: AbortSignal) => Promise<ReleaseBucket>
  create: (payload: ReleaseBucketPayload) => Promise<ServerMessage>
  update: (id: number, payload: ReleaseBucketUpdatePayload | { is_active: boolean }) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
}

const live: ReleaseBucketsApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/release-buckets',
      searchParams: { page },
      schema: releaseBucketPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: `/release-buckets/${id}`,
      schema: releaseBucketDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/release-buckets', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: `/release-buckets/${id}`, body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: `/release-buckets/${id}`, schema: serverMessageSchema }),
}

function backend(): Promise<ReleaseBucketsApi> {
  return Promise.resolve(live)
}

async function send(call: (api: ReleaseBucketsApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, RELEASE_BUCKET_FORM_FIELD_FOR)
  }
}

/**
 * Every bucket — this screen filters them by practice, and the insurance form
 * picks one. The list is paged by the server, so this reads page 1, then the
 * rest at once; a practice has a handful of buckets.
 */
export async function listReleaseBuckets(signal?: AbortSignal): Promise<ReleaseBucket[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.buckets)
}

export async function getReleaseBucket(id: number, signal?: AbortSignal): Promise<ReleaseBucket> {
  return (await backend()).get(id, signal)
}

export function createReleaseBucket(values: ReleaseBucketFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toReleaseBucketPayload(values)))
}

export function updateReleaseBucket(id: number, values: ReleaseBucketFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toReleaseBucketUpdatePayload(values)))
}

/** Activates or deactivates a bucket: a save carrying `is_active` alone. */
export function setReleaseBucketActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

export function deleteReleaseBucket(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

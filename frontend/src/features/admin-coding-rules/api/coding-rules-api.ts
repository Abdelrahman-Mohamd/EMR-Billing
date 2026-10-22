import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { MAX_PER_PAGE } from '@/lib/api/pagination'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import type { CodingRule } from '../model/coding-rule'
import {
  codingRuleFormFieldFor,
  codingRulePageResponseSchema,
  codingRulePreviewResponseSchema,
  type CodingRulePayload,
  type CodingRulePreview,
  type CodingRuleUpdatePayload,
} from '../schemas/coding-rule'

/**
 * Coding rules' only door to a server. **Live** (worked out on staging
 * 2026-10-20 — no contract was given), carrying the session's token:
 * `GET /coding-rules?page=N&per_page=100&practice_id=P`, `POST /coding-rules`,
 * `PUT /coding-rules/{id}`, `DELETE` and `GET /coding-rules/preview` (what the
 * rules do to one code for one insurance). Writes resolve with the server's
 * message. Shapes in schemas/coding-rule.ts.
 */
export interface CodingRulesApi {
  list: (
    page: number,
    practiceId: number,
    signal?: AbortSignal,
  ) => Promise<{ rules: CodingRule[]; pageCount: number }>
  create: (payload: CodingRulePayload) => Promise<ServerMessage>
  update: (id: number, payload: CodingRuleUpdatePayload | { is_active: boolean }) => Promise<ServerMessage>
  remove: (id: number) => Promise<ServerMessage>
  preview: (query: PreviewQuery, signal?: AbortSignal) => Promise<CodingRulePreview>
}

/** What the preview asks about: one code, for one insurance of the practice. */
export interface PreviewQuery {
  practiceId: number
  insuranceId: number
  procedureCodeId: number
}

const path = (id: number) => `/coding-rules/${encodeURIComponent(String(id))}`

const live: CodingRulesApi = {
  list: (page, practiceId, signal) =>
    request({
      method: 'GET',
      path: '/coding-rules',
      searchParams: { page, per_page: MAX_PER_PAGE, practice_id: practiceId },
      schema: codingRulePageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/coding-rules', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
  preview: (query, signal) =>
    request({
      method: 'GET',
      path: '/coding-rules/preview',
      searchParams: {
        practice_id: query.practiceId,
        insurance_id: query.insuranceId,
        procedure_code_id: query.procedureCodeId,
      },
      schema: codingRulePreviewResponseSchema,
      ...(signal ? { signal } : {}),
    }),
}

function backend(): Promise<CodingRulesApi> {
  return Promise.resolve(live)
}

async function send(call: (api: CodingRulesApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, codingRuleFormFieldFor)
  }
}

/**
 * A practice's rules, in the server's order. The list is paged by the server,
 * so this reads page 1, then the rest at once.
 */
export async function listCodingRules(practiceId: number, signal?: AbortSignal): Promise<CodingRule[]> {
  const api = await backend()
  const first = await api.list(1, practiceId, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, practiceId, signal)),
  )
  return [first, ...rest].flatMap((page) => page.rules)
}

export function createCodingRule(payload: CodingRulePayload): Promise<ServerMessage> {
  return send((api) => api.create(payload))
}

export function updateCodingRule(id: number, payload: CodingRuleUpdatePayload): Promise<ServerMessage> {
  return send((api) => api.update(id, payload))
}

export function setCodingRuleActive(id: number, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

export function deleteCodingRule(id: number): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}

/** What the practice's active rules do to one code for one insurance, as the server works it out. */
export async function previewCodingRule(
  query: PreviewQuery,
  signal?: AbortSignal,
): Promise<CodingRulePreview> {
  return (await backend()).preview(query, signal)
}

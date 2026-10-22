import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCodingRule,
  deleteCodingRule,
  listCodingRules,
  previewCodingRule,
  setCodingRuleActive,
  type PreviewQuery,
  updateCodingRule,
} from '../api/coding-rules-api'
import type { CodingRulePayload, CodingRuleUpdatePayload } from '../schemas/coding-rule'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const codingRuleKeys = {
  all: ['coding-rules'] as const,
  list: (practiceId: number) => [...codingRuleKeys.all, 'list', practiceId] as const,
  preview: (query: PreviewQuery) => [...codingRuleKeys.all, 'preview', query] as const,
}

/** A practice's rules; waits until there is a practice. */
export function useCodingRules(practiceId: number | undefined) {
  return useQuery({
    queryKey: codingRuleKeys.list(practiceId ?? 0),
    queryFn: ({ signal }) => listCodingRules(practiceId ?? 0, signal),
    enabled: practiceId !== undefined,
  })
}

function useInvalidateCodingRules() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: codingRuleKeys.all })
}

export function useCreateCodingRule() {
  const invalidate = useInvalidateCodingRules()
  return useMutation({
    mutationFn: (payload: CodingRulePayload) => createCodingRule(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateCodingRule() {
  const invalidate = useInvalidateCodingRules()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CodingRuleUpdatePayload }) =>
      updateCodingRule(id, payload),
    onSuccess: invalidate,
  })
}

export function useSetCodingRuleActive() {
  const invalidate = useInvalidateCodingRules()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setCodingRuleActive(id, isActive),
    onSuccess: invalidate,
  })
}

export function useDeleteCodingRule() {
  const invalidate = useInvalidateCodingRules()
  return useMutation({
    mutationFn: (id: number) => deleteCodingRule(id),
    onSuccess: invalidate,
  })
}

/**
 * The server's preview for each code, for one insurance of the practice — the
 * rules' changes clear them (every key under `all`).
 */
export function useCodingRulePreviews(
  practiceId: number,
  insuranceId: number | undefined,
  codeIds: readonly number[],
) {
  return useQueries({
    queries: codeIds.map((procedureCodeId) => {
      const query = { practiceId, insuranceId: insuranceId ?? 0, procedureCodeId }
      return {
        queryKey: codingRuleKeys.preview(query),
        queryFn: ({ signal }: { signal: AbortSignal }) => previewCodingRule(query, signal),
        enabled: insuranceId !== undefined,
      }
    }),
  })
}

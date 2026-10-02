import { useSyncExternalStore } from 'react'
import type { CodingRule } from '../model/coding-rule'

/**
 * WHERE CODING RULES LIVE FOR NOW — a temporary, in-memory store in this
 * browser tab. **There is no backend for coding rules**, so nothing here calls
 * a server, and nothing pretends to: no endpoint, payload or request. This is
 * architecture only; the screen shows no message about it.
 *
 * - Changes last until the page reloads. No claim is scrubbed by them: the
 *   rules engine is the server's.
 * - In development and tests it starts with the prototype's rules
 *   (`sample-coding-rules.ts`, loaded only when `__MOCK_DATA__` is true, so a
 *   production build never contains them); otherwise it starts empty.
 * - The screens only use `useCodingRules()`. When a backend exists, that hook
 *   is replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5) and
 *   this file is deleted — the screens do not change.
 * - Nothing here enforces who may change rules: the server decides that on
 *   every request (docs/SECURITY.md §1).
 *
 * Same pattern as the roles, procedure codes and fee schedules stores.
 */
interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  /** In the order they were added, as the prototype lists them. */
  rules: readonly CodingRule[]
}

let snapshot: Snapshot = { ready: !__MOCK_DATA__, rules: [] }
const listeners = new Set<() => void>()
let nextId = 1

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-coding-rules').then(({ SAMPLE_CODING_RULES }) => {
    // Something may have been added while the sample loaded; keep it.
    if (!snapshot.ready) publish({ ready: true, rules: [...SAMPLE_CODING_RULES, ...snapshot.rules] })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** What the rule dialog saves — everything but the id and the active flag. */
export type CodingRuleValues = Omit<CodingRule, 'id' | 'isActive'>

export interface CodingRulesSource extends Snapshot {
  /** A new rule is active, as in the prototype. */
  create: (values: CodingRuleValues) => void
  update: (id: string, values: CodingRuleValues) => void
  setActive: (id: string, isActive: boolean) => void
  remove: (id: string) => void
}

export function useCodingRules(): CodingRulesSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ...current,
    create: (values) =>
      publish({
        ...snapshot,
        rules: [...snapshot.rules, { ...values, id: `rule-${nextId++}`, isActive: true }],
      }),
    update: (id, values) =>
      publish({
        ...snapshot,
        rules: snapshot.rules.map((rule) => (rule.id === id ? { ...rule, ...values } : rule)),
      }),
    setActive: (id, isActive) =>
      publish({
        ...snapshot,
        rules: snapshot.rules.map((rule) => (rule.id === id ? { ...rule, isActive } : rule)),
      }),
    remove: (id) => publish({ ...snapshot, rules: snapshot.rules.filter((rule) => rule.id !== id) }),
  }
}

/** Tests only: start from a known list. */
export function resetCodingRules(rules: readonly CodingRule[]): void {
  publish({ ready: true, rules: structuredClone([...rules]) })
}

/**
 * Coding rules as the screens see them (PRD V2 §6.1). The rules are the
 * server's (schemas/coding-rule.ts); each belongs to a practice and acts on one
 * CPT / HCPCS code when a visit is released (scrubbing):
 * - **Replace** — converts the code to another (`toCode`).
 * - **Drop** — removes the code's line.
 *
 * It belongs to one insurance of the practice (since 2026-10-22; a default
 * rule, every payer, from before is still read). What the rules do to a code
 * is the server's to work out (`GET /coding-rules/preview`): nothing here
 * decides which rule wins. The prototype's class rules have no place on the
 * server, so there are none.
 */
export const RULE_TYPES = ['Replace', 'Drop'] as const
export type RuleType = (typeof RULE_TYPES)[number]

export type RuleScope = { kind: 'default' } | { kind: 'insurance'; insuranceId: number }

export interface CodingRule {
  /** The server's id. */
  id: number
  practiceId: number
  type: RuleType
  /** The procedure code it acts on: its id, and the code itself ("97014"). */
  fromCodeId: number
  fromCode: string
  /** The replacement: its id and code; null and '' for a Drop rule. */
  toCodeId: number | null
  toCode: string
  scope: RuleScope
  /** The insurance as the server names it; '' for a default rule. */
  insuranceName: string
  /** The prototype's "Why"; '' when none. */
  note: string
  isActive: boolean
}

/** A scope as one select value: "default", "insurance:12". */
export function scopeKey(scope: RuleScope): string {
  return scope.kind === 'default' ? 'default' : `insurance:${scope.insuranceId}`
}

export function scopeFromKey(key: string): RuleScope | null {
  if (key === 'default') return { kind: 'default' }
  const [kind, raw] = key.split(':')
  const id = Number(raw)
  if (kind !== 'insurance' || !Number.isInteger(id) || id <= 0) return null
  return { kind: 'insurance', insuranceId: id }
}

/** "Replace 97014 → G0283", "Drop 97010" — how a rule is named in a confirmation or a control's label. */
export function ruleName(rule: Pick<CodingRule, 'type' | 'fromCode' | 'toCode'>): string {
  return rule.type === 'Replace' ? `Replace ${rule.fromCode} → ${rule.toCode}` : `Drop ${rule.fromCode}`
}

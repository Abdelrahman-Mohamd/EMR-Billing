/**
 * Coding rules as the prototype shows them (PRD V2 §6.1). **Frontend only:**
 * no backend exists for coding rules, so this is the screen's own shape, not a
 * contract.
 *
 * A rule acts on one CPT / HCPCS code during scrubbing:
 * - **Replace** — converts the code to another (`toCode`).
 * - **Drop** — removes the code from the claim.
 *
 * It applies by default (every payer), to one insurance class, or to one
 * insurance — the prototype's three "Applies to" choices. Class rules come
 * from the client meeting; V2 names default and payer rules only.
 */
export const RULE_TYPES = ['Replace', 'Drop'] as const
export type RuleType = (typeof RULE_TYPES)[number]

export type RuleScope =
  { kind: 'default' } | { kind: 'class'; classId: number } | { kind: 'insurance'; insuranceId: number }

export interface CodingRule {
  id: string
  type: RuleType
  fromCode: string
  /** The replacement; '' for a Drop rule. */
  toCode: string
  scope: RuleScope
  /** The prototype's "Why" — optional. */
  note: string
  isActive: boolean
}

/** A scope as one select value: "default", "class:3", "insurance:12". */
export function scopeKey(scope: RuleScope): string {
  if (scope.kind === 'default') return 'default'
  return scope.kind === 'class' ? `class:${scope.classId}` : `insurance:${scope.insuranceId}`
}

export function scopeFromKey(key: string): RuleScope | null {
  if (key === 'default') return { kind: 'default' }
  const [kind, raw] = key.split(':')
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return null
  if (kind === 'class') return { kind: 'class', classId: id }
  if (kind === 'insurance') return { kind: 'insurance', insuranceId: id }
  return null
}

/**
 * Which active rule acts on a code for an insurance — the prototype's
 * precedence: the insurance's own rule, then its class's, then the default
 * (PRD V2 §6.1: "payer-specific rules override default rules"; the class step
 * is assumed, open question Q-097).
 *
 * Used only by "Test the rules", to preview. Scrubbing itself — what really
 * happens to a claim — is the server's.
 */
export function ruleFor(
  rules: readonly CodingRule[],
  code: string,
  insurance: { id: number; insuranceClassId: number },
): CodingRule | undefined {
  const active = rules.filter((rule) => rule.isActive && rule.fromCode === code)
  return (
    active.find((rule) => rule.scope.kind === 'insurance' && rule.scope.insuranceId === insurance.id) ??
    active.find((rule) => rule.scope.kind === 'class' && rule.scope.classId === insurance.insuranceClassId) ??
    active.find((rule) => rule.scope.kind === 'default')
  )
}

/** "Replace 97014 → G0283", "Drop 97010" — how a rule is named in a confirmation or a control's label. */
export function ruleName(rule: Pick<CodingRule, 'type' | 'fromCode' | 'toCode'>): string {
  return rule.type === 'Replace' ? `Replace ${rule.fromCode} → ${rule.toCode}` : `Drop ${rule.fromCode}`
}

/**
 * The billing rules an insurance class holds and an insurance may override
 * (PRD V2 §10.3, CH-02) — the five of the prototype, no more.
 *
 * Confirmed requirement (PRD V2 §10.3): "Null = inherit from insurance_class.
 * Effective value = COALESCE(insurance, class)." That is the only rule this
 * file computes. What each rule then does to a claim is the server's.
 */
export const BOOLEAN_RULES = [
  { key: 'authorizationRequired', label: 'Authorization required' },
  { key: 'injuryDateRequired', label: 'Injury date required' },
  { key: 'applySpecialtyModifiers', label: 'Apply specialty modifiers' },
  { key: 'acceptAssignment', label: 'Accept assignment' },
] as const

export type BooleanRuleKey = (typeof BOOLEAN_RULES)[number]['key']

/** The ICD versions the prototype offers. */
export const ICD_VERSIONS = ['ICD10', 'ICD9'] as const

/** A class's rule defaults: every rule has a value. */
export type ClassRules = Record<BooleanRuleKey, boolean> & { icdVersion: string }

/** An insurance's yes/no rules: `null` inherits the class value. */
export type BooleanOverrides = Record<BooleanRuleKey, boolean | null>

/** An insurance's rules: `null` inherits the class value. */
export type RuleOverrides = BooleanOverrides & { icdVersion: string | null }

export interface EffectiveRule {
  key: BooleanRuleKey | 'icdVersion'
  label: string
  /** "Yes", "No", or the ICD version. */
  value: string
  /** Where the value comes from. */
  source: 'class' | 'override'
}

const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

/** Each rule's effective value for an insurance in this class — COALESCE(insurance, class). */
export function effectiveRules(classRules: ClassRules, overrides: RuleOverrides): EffectiveRule[] {
  const booleans = BOOLEAN_RULES.map(({ key, label }): EffectiveRule => {
    const own = overrides[key]
    return own === null
      ? { key, label, value: yesNo(classRules[key]), source: 'class' }
      : { key, label, value: yesNo(own), source: 'override' }
  })
  const icd: EffectiveRule =
    overrides.icdVersion === null
      ? { key: 'icdVersion', label: 'ICD version', value: classRules.icdVersion, source: 'class' }
      : { key: 'icdVersion', label: 'ICD version', value: overrides.icdVersion, source: 'override' }
  return [...booleans, icd]
}

/** True when the insurance sets at least one rule of its own. */
export function hasOverrides(overrides: BooleanOverrides & { icdVersion?: string | null }): boolean {
  return (overrides.icdVersion ?? null) !== null || BOOLEAN_RULES.some(({ key }) => overrides[key] !== null)
}

/** Each yes/no rule's effective value — COALESCE(insurance, class) — for the list, which has no ICD override. */
export function effectiveBooleans(
  classRules: Record<BooleanRuleKey, boolean>,
  overrides: BooleanOverrides,
): Record<BooleanRuleKey, boolean> {
  return Object.fromEntries(
    BOOLEAN_RULES.map(({ key }) => [key, overrides[key] ?? classRules[key]]),
  ) as Record<BooleanRuleKey, boolean>
}

/**
 * The insurance types the server accepts — the claim filing indicator codes —
 * with the label it gives each (`insurance_type_label`, read on staging
 * 2026-10-08; any other code is refused).
 */
export const INSURANCE_TYPES = [
  { value: 'CI', label: 'Commercial' },
  { value: 'MB', label: 'Medicare Part B' },
  { value: 'MC', label: 'Medicaid' },
  { value: 'BL', label: 'Blue Cross / Blue Shield' },
  { value: 'HM', label: 'HMO' },
  { value: 'WC', label: "Workers' Comp" },
  { value: 'AM', label: 'Auto / PIP' },
  { value: 'CH', label: 'Tricare' },
  { value: 'VA', label: 'Veterans Affairs' },
  { value: 'OF', label: 'Other Federal' },
  { value: 'ZZ', label: 'Other' },
] as const

/** A type code's label; an unknown code is shown as sent. */
export function insuranceTypeLabel(value: string): string {
  return INSURANCE_TYPES.find((type) => type.value === value)?.label ?? value
}

/** The claim formats the prototype offers. */
export const CLAIM_FORMATS = [
  { value: '837P', label: 'EDI 837P' },
  { value: 'CMS1500', label: 'Paper CMS-1500 (print queue)' },
] as const

export function claimFormatLabel(value: string): string {
  return CLAIM_FORMATS.find((format) => format.value === value)?.label ?? value
}

/** How the prototype names an insurance: its code, then its name. */
export function insuranceLabel(insurance: { code: number; name: string }): string {
  return `${insurance.code} – ${insurance.name}`
}

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

/** An insurance's rules: `null` inherits the class value. */
export type RuleOverrides = Record<BooleanRuleKey, boolean | null> & { icdVersion: string | null }

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
export function hasOverrides(overrides: RuleOverrides): boolean {
  return overrides.icdVersion !== null || BOOLEAN_RULES.some(({ key }) => overrides[key] !== null)
}

/** The insurance types the prototype offers — the claim filing indicator. */
export const INSURANCE_TYPES = ['Commercial', 'Medicare', 'Workers Comp', 'PIP'] as const

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

import type { Insurance, InsuranceClass } from '@/features/admin-insurances'

/**
 * An insurance rule's effective value — the insurance's own, else its class's
 * (PRD V2 §10.3: COALESCE(insurance, class)). The same reading Setup →
 * Insurances shows. Used here only to say what the prototype says: that a
 * payer requires an authorization or an injury date.
 */
export function effectiveRule(
  insurance: Insurance | undefined,
  classes: readonly InsuranceClass[],
  key: 'authorizationRequired' | 'injuryDateRequired',
): boolean {
  if (insurance === undefined) return false
  const own = insurance.rules[key]
  if (own !== null) return own
  return classes.find((item) => item.id === insurance.insuranceClassId)?.[key] ?? false
}

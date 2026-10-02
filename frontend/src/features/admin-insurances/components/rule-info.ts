import { BOOLEAN_RULES } from '../model/rules'

/**
 * The field note beside each billing rule, shared by the class form and the
 * insurance form. Each says what the rule means on a claim, as PRD V2 and the
 * prototype describe it — nothing about how the server applies it.
 */
const INFO: Record<(typeof BOOLEAN_RULES)[number]['key'], string> = {
  authorizationRequired: "Visits need the payer's authorization before their claims are submitted.",
  injuryDateRequired: 'The injury date (Box 14) must be filled on the claim.',
  applySpecialtyModifiers: 'Adds the therapy modifier (GP, GO or GN) to therapy lines.',
  acceptAssignment: 'Box 27 of the claim.',
}

export const RULE_INFO = BOOLEAN_RULES.map((rule) => ({ ...rule, info: INFO[rule.key] }))

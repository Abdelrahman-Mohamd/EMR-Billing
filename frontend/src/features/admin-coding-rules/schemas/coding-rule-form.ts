import { z } from 'zod'
import { RULE_TYPES, scopeFromKey, scopeKey, type CodingRule } from '../model/coding-rule'
import type { CodingRuleUpdatePayload } from './coding-rule'

export const NOTE_MAX = 1000

/**
 * What the coding-rule form accepts — the server's rules (schemas/coding-rule.ts):
 * - **Rule type:** Replace or Drop.
 * - **Code:** required.
 * - **Replace with:** required for a Replace rule, and not the same code
 *   ("Please choose a different code."). Ignored for a Drop rule.
 * - **Applies to:** required — one insurance of the practice (the server has
 *   no default rule since 2026-10-22).
 * - **Why:** at most 1000 characters.
 *
 * Codes are the procedure codes' ids, as text. Every check runs in one pass,
 * so a user sees all of them at once. One rule per code for an insurance is
 * the server's to say, on the code.
 */
export const codingRuleFormSchema = z
  .object({
    type: z.enum(RULE_TYPES),
    fromCode: z.string().nullable(),
    toCode: z.string().nullable(),
    scope: z.string(),
    note: z.string().trim().max(NOTE_MAX, `Use at most ${NOTE_MAX} characters.`),
  })
  .superRefine((values, ctx) => {
    if (values.fromCode === null)
      ctx.addIssue({ code: 'custom', path: ['fromCode'], message: 'Select a code.' })
    if (values.type === 'Replace') {
      if (values.toCode === null)
        ctx.addIssue({ code: 'custom', path: ['toCode'], message: 'Select the code to replace it with.' })
      else if (values.toCode === values.fromCode)
        ctx.addIssue({ code: 'custom', path: ['toCode'], message: 'Please choose a different code.' })
    }
    if (scopeFromKey(values.scope)?.kind !== 'insurance')
      ctx.addIssue({ code: 'custom', path: ['scope'], message: 'Select the insurance it applies to.' })
  })

export type CodingRuleFormValues = z.infer<typeof codingRuleFormSchema>

/** A new rule starts as the prototype's does: Replace — for an insurance still to choose. */
export function newCodingRuleValues(): CodingRuleFormValues {
  return { type: 'Replace', fromCode: null, toCode: null, scope: '', note: '' }
}

export function toCodingRuleFormValues(rule: CodingRule): CodingRuleFormValues {
  return {
    type: rule.type,
    fromCode: String(rule.fromCodeId),
    toCode: rule.toCodeId === null ? null : String(rule.toCodeId),
    scope: scopeKey(rule.scope),
    note: rule.note,
  }
}

/** The values the schema accepted, as the server takes them. A Drop rule sends no replacement. */
export function toCodingRulePayload(values: CodingRuleFormValues): CodingRuleUpdatePayload {
  const scope = scopeFromKey(values.scope)
  return {
    action: values.type === 'Replace' ? 'replace' : 'drop',
    procedure_code_id: Number(values.fromCode),
    replacement_code_id: values.type === 'Replace' ? Number(values.toCode) : null,
    // The schema has refused anything but an insurance before this runs.
    insurance_id: scope?.kind === 'insurance' ? scope.insuranceId : 0,
    notes: values.note === '' ? null : values.note,
  }
}

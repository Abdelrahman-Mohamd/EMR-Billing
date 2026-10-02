import { z } from 'zod'
import type { CodingRuleValues } from '../data/coding-rule-store'
import { RULE_TYPES, scopeFromKey, scopeKey, type CodingRule } from '../model/coding-rule'

/**
 * What the coding-rule form accepts — the prototype's checks, and only those:
 * - **Rule type:** Replace or Drop.
 * - **Code:** required.
 * - **Replace with:** required for a Replace rule, and not the same code
 *   ("Please choose a different code."). Ignored for a Drop rule.
 * - **Applies to:** required — the default, a class or an insurance.
 * - **Why:** optional.
 *
 * Every check runs in one pass, so a user sees all of them at once.
 */
export const codingRuleFormSchema = z
  .object({
    type: z.enum(RULE_TYPES),
    fromCode: z.string().nullable(),
    toCode: z.string().nullable(),
    scope: z.string(),
    note: z.string().trim(),
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
    if (scopeFromKey(values.scope) === null)
      ctx.addIssue({ code: 'custom', path: ['scope'], message: 'Select what the rule applies to.' })
  })

export type CodingRuleFormValues = z.infer<typeof codingRuleFormSchema>

/** A new rule starts as the prototype's does: Replace, applying by default. */
export function newCodingRuleValues(): CodingRuleFormValues {
  return { type: 'Replace', fromCode: null, toCode: null, scope: 'default', note: '' }
}

export function toCodingRuleFormValues(rule: CodingRule): CodingRuleFormValues {
  return {
    type: rule.type,
    fromCode: rule.fromCode,
    toCode: rule.toCode === '' ? null : rule.toCode,
    scope: scopeKey(rule.scope),
    note: rule.note,
  }
}

/** The values the schema accepted, as a rule. A Drop rule keeps no replacement, as in the prototype. */
export function toCodingRuleValues(values: CodingRuleFormValues): CodingRuleValues {
  return {
    type: values.type,
    fromCode: values.fromCode ?? '',
    toCode: values.type === 'Replace' ? (values.toCode ?? '') : '',
    scope: scopeFromKey(values.scope) ?? { kind: 'default' },
    note: values.note,
  }
}

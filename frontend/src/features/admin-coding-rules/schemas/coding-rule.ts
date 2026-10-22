import { z } from 'zod'
import type { CodingRule } from '../model/coding-rule'

/**
 * A coding rule, as the backend sends and takes it. No contract was given:
 * this is what staging answered (2026-10-20), tried with made-up rules and
 * deleted after:
 *
 * - `GET /coding-rules?page=N` → Laravel pagination of `{ id, practice_id,
 *   scope, insurance_id, insurance: { id, name }, action, procedure_code_id,
 *   procedure_code: { id, code, description }, replacement_code_id,
 *   replacement_code, summary, is_active, notes, created_at, updated_at }`;
 *   `GET /coding-rules/{id}` → the same. It filters by `practice_id`,
 *   `insurance_id`, `action`, `procedure_code_id` and `is_active`, and takes
 *   `per_page` (at most 100); `search` is ignored.
 * - `POST /coding-rules` `{ practice_id, action, procedure_code_id,
 *   replacement_code_id?, insurance_id?, notes?, is_active? }`; `PUT
 *   /coding-rules/{id}` changes only the fields it carries (`practice_id` is
 *   refused); `DELETE`. Writes answer `{ success, message, data: null }` — no
 *   new id.
 *
 * Seen on staging: required are the practice, the action (`replace` or `drop`)
 * and the code. A replace rule needs a replacement ("A replace rule needs the
 * code to replace with.") that is not the code itself ("A code cannot be
 * replaced with itself."), both on `replacement_code_id`; a drop rule keeps
 * none (the server clears it). The insurance, when given, must be one of the
 * practice's ("The insurance must belong to the same practice."); none is the
 * default rule (`scope: default`), one is a payer's (`scope: payer`). A code
 * has one default rule and one rule per payer ("There is already a default
 * rule for this code.", "This payer already has a rule for this code.", on
 * `procedure_code_id`). Notes: at most 1000 characters. A new rule is active.
 * `insurance_class_id` is ignored: the server has no class rules.
 *
 * **Since 2026-10-22 every rule belongs to an insurance** ("A coding rule must
 * belong to an insurance.", on `insurance_id`, for a create and a save): no
 * new default rule can be made. A `scope: default` rule from before is still
 * read and shown.
 *
 * `GET /coding-rules/preview?practice_id&insurance_id&procedure_code_id` —
 * all three required — says what the practice's active rules do to one code
 * for one insurance: `{ message, data }` — the rule that acts (its summary as
 * the message, "Drop 97014 for Corvel Enterprise"), or `null` and "No rule
 * applies: the code is billed as entered".
 *
 * When a visit is released, its practice's active rules act on its lines: the
 * payer's rule over the default; a replace rule changes the line's code and
 * price (the line keeps `coding_rule_id` and `original_procedure_code_id`), a
 * drop rule removes the line.
 */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '')

const codeRef = z
  .object({ code: text })
  .nullable()
  .optional()
  .transform((value) => value?.code ?? '')

export const codingRuleResponseSchema = z
  .object({
    id: z.number().int(),
    practice_id: z.number().int(),
    insurance_id: z.number().int().nullable().optional(),
    insurance: z.object({ name: text }).nullable().optional(),
    action: z.enum(['replace', 'drop']),
    procedure_code_id: z.number().int(),
    procedure_code: codeRef,
    replacement_code_id: z.number().int().nullable().optional(),
    replacement_code: codeRef,
    is_active: z.boolean(),
    notes: text,
  })
  .transform((wire): CodingRule => ({
    id: wire.id,
    practiceId: wire.practice_id,
    type: wire.action === 'replace' ? 'Replace' : 'Drop',
    fromCodeId: wire.procedure_code_id,
    fromCode: wire.procedure_code,
    toCodeId: wire.action === 'replace' ? (wire.replacement_code_id ?? null) : null,
    toCode: wire.action === 'replace' ? wire.replacement_code : '',
    scope:
      wire.insurance_id === null || wire.insurance_id === undefined
        ? { kind: 'default' }
        : { kind: 'insurance', insuranceId: wire.insurance_id },
    insuranceName: wire.insurance?.name ?? '',
    note: wire.notes,
    isActive: wire.is_active,
  }))

export const codingRulePageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(codingRuleResponseSchema),
      meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }),
    }),
  })
  .transform(({ data }) => ({ rules: data.data, pageCount: data.meta.last_page }))

/** Saving a rule (`PUT`): every field the form holds, so a cleared one clears. */
export interface CodingRuleUpdatePayload {
  action: 'replace' | 'drop'
  procedure_code_id: number
  /** Null for a drop rule. */
  replacement_code_id: number | null
  /** The insurance the rule belongs to. */
  insurance_id: number
  notes: string | null
}

/** Creating a rule (`POST`): with its practice. */
export interface CodingRulePayload extends CodingRuleUpdatePayload {
  practice_id: number
}

const FIELDS: Readonly<Record<string, string>> = {
  action: 'type',
  procedure_code_id: 'fromCode',
  replacement_code_id: 'toCode',
  insurance_id: 'scope',
  notes: 'note',
}

/** Backend field → form field, so a server's field error lands on the right input. */
export const codingRuleFormFieldFor = (path: string): string => FIELDS[path] ?? path

/** The preview's answer: the server's words, and the rule that acts on the code — or none. */
export const codingRulePreviewResponseSchema = z
  .object({ message: z.string().nullable().optional(), data: codingRuleResponseSchema.nullable().optional() })
  .transform(({ message, data }) => ({ message: message ?? null, rule: data ?? null }))

export type CodingRulePreview = z.output<typeof codingRulePreviewResponseSchema>

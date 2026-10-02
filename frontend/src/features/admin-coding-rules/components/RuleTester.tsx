import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { MultiSelect, type SearchSelectOption } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import type { Insurance } from '@/features/admin-insurances'
import { cn } from '@/lib/utils/cn'
import { ruleFor, type CodingRule } from '../model/coding-rule'

interface Outcome {
  code: string
  rule: CodingRule | undefined
  /** A payer or class rule won over an active default rule for the same code. */
  overridesDefault: boolean
}

/**
 * The prototype's "Test the rules": pick a payer and the codes on a claim, and
 * see what the active rules do — each code as it goes in and comes out, what
 * happened and which rule decided (with its Why), then the claim's codes after
 * the rules.
 *
 * A dialog opened from the page header, so it is one click away however long
 * the list of rules grows. Nothing to save, so no footer: × or Escape closes
 * it. It starts afresh each time it opens.
 *
 * Codes are picked from the procedure codes list rather than typed, so a typo
 * can never read as "no rule applies". The inputs sit side by side when the
 * dialog is wide enough (a container query), stacked on a phone.
 *
 * A preview of the rules on this screen, worked out here with the prototype's
 * precedence (`ruleFor`). It changes nothing; the real scrub is the server's.
 */
export function RuleTester({
  insurances,
  rules,
  codeOptions,
  appliesTo,
  onClose,
}: {
  /** The practice's insurances. */
  insurances: readonly Insurance[]
  rules: readonly CodingRule[]
  /** Every procedure code: the code as the label, its description under it. */
  codeOptions: readonly SearchSelectOption[]
  /** How the list names a rule's scope: "Medicare Part B only", "Default (all payers)". */
  appliesTo: (rule: CodingRule) => string
  onClose: () => void
}) {
  const [insuranceId, setInsuranceId] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[]>([])

  const insurance = insurances.find((item) => String(item.id) === insuranceId) ?? insurances[0]
  const outcomes: Outcome[] =
    insurance === undefined
      ? []
      : // In the list's order, as the chips show them.
        [...codes]
          .sort(
            (a, b) =>
              codeOptions.findIndex((option) => option.value === a) -
              codeOptions.findIndex((option) => option.value === b),
          )
          .map((code) => {
            const rule = ruleFor(rules, code, insurance)
            return {
              code,
              rule,
              overridesDefault:
                rule !== undefined &&
                rule.scope.kind !== 'default' &&
                rules.some(
                  (other) => other.isActive && other.fromCode === code && other.scope.kind === 'default',
                ),
            }
          })
  const after = outcomes.flatMap(({ code, rule }) =>
    rule === undefined ? [code] : rule.type === 'Replace' ? [rule.toCode] : [],
  )
  const changed = outcomes.filter((outcome) => outcome.rule !== undefined).length

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Test the rules"
      description="See what the active rules do to the codes on a claim for one payer."
      size="md"
    >
      <div className="@container">
        {/* Fields span a 12-column form grid by default; here each takes one of two columns. */}
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field label="Payer" className="sm:col-span-1">
            <Select
              value={insurance === undefined ? null : String(insurance.id)}
              onChange={setInsuranceId}
              options={insurances.map((item) => ({ value: String(item.id), label: item.name }))}
              placeholder="No insurances yet"
              disabled={insurances.length === 0}
            />
          </Field>
          <Field label="Codes on the claim" className="sm:col-span-1">
            <MultiSelect
              value={codes}
              onChange={setCodes}
              options={codeOptions}
              placeholder="Select codes"
              searchPlaceholder="Search codes"
              disabled={insurance === undefined}
            />
          </Field>
        </div>

        {insurance === undefined ? (
          <p className="text-micro text-n500 mt-5">
            Payer rules are tested against an insurance of this practice.
          </p>
        ) : outcomes.length === 0 ? (
          <p className="text-micro text-n500 mt-5">
            Choose the codes on a claim to see what the rules do to them.
          </p>
        ) : (
          <div aria-live="polite" className="mt-5">
            <ul aria-label="What the rules do" className="grid gap-3.5">
              {outcomes.map(({ code, rule, overridesDefault }) => (
                <li key={code}>
                  <span className="text-meta text-ink block font-medium tabular-nums">
                    {code}
                    {rule !== undefined && (
                      <>
                        <span className="text-n400 font-normal" aria-hidden="true">
                          {' '}
                          →{' '}
                        </span>
                        <span className="sr-only"> becomes </span>
                        {rule.type === 'Replace' ? (
                          rule.toCode
                        ) : (
                          <span className="text-n500 font-normal">dropped</span>
                        )}
                      </>
                    )}
                  </span>
                  <span className="text-micro text-n500 mt-0.5 block">
                    {rule === undefined ? (
                      'No rule applies'
                    ) : (
                      <>
                        <span
                          className={cn(
                            'font-medium',
                            rule.type === 'Replace' ? 'text-brand-deep' : 'text-sand-deep',
                          )}
                        >
                          {rule.type === 'Replace' ? 'Replaced' : 'Dropped'}
                        </span>
                        {` · ${appliesTo(rule)}`}
                        {overridesDefault && ' · overrides the default rule'}
                      </>
                    )}
                  </span>
                  {rule !== undefined && rule.note !== '' && (
                    <span className="text-micro text-n600 mt-0.5 block break-words">{rule.note}</span>
                  )}
                </li>
              ))}
            </ul>

            <p className="text-micro text-n500 mt-5">
              <span className="text-eyebrow block font-medium uppercase">Claim after the rules</span>
              <span className="text-meta text-ink mt-1 block font-medium tabular-nums">
                {after.length === 0 ? 'No codes left on the claim' : after.join(' · ')}
              </span>
              <span className="mt-0.5 block">
                {changed === 0
                  ? 'No code changed.'
                  : `${changed} of ${outcomes.length} ${outcomes.length === 1 ? 'code' : 'codes'} changed.`}
              </span>
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}

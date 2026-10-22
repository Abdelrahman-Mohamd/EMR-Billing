import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { MultiSelect, type SearchSelectOption } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import type { Insurance } from '@/features/admin-insurances'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { cn } from '@/lib/utils/cn'
import { useCodingRulePreviews } from '../queries/use-coding-rules'

/**
 * The prototype's "Test the rules": pick a payer and the codes on a claim, and
 * see what the active rules do — each code as it goes in and comes out, in the
 * server's words, with the rule's Why — then the claim's codes after the
 * rules.
 *
 * Every answer is the server's (`GET /coding-rules/preview`, one per code):
 * nothing here works out which rule acts. A dialog opened from the page
 * header; nothing to save, so no footer: × or Escape closes it. It starts
 * afresh each time it opens.
 *
 * Codes are picked from the procedure codes list rather than typed, so a typo
 * can never read as "no rule applies". The inputs sit side by side when the
 * dialog is wide enough (a container query), stacked on a phone.
 */
export function RuleTester({
  practiceId,
  insurances,
  codeOptions,
  onClose,
}: {
  practiceId: number
  /** The practice's insurances. */
  insurances: readonly Insurance[]
  /** Every procedure code by its id: the code as the label, its description under it. */
  codeOptions: readonly SearchSelectOption[]
  onClose: () => void
}) {
  const [insuranceId, setInsuranceId] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[]>([])

  const insurance = insurances.find((item) => String(item.id) === insuranceId) ?? insurances[0]
  // In the list's own order, as the chips show them — read off the list, not sorted.
  const chosen = codeOptions.filter((option) => codes.includes(option.value))
  const previews = useCodingRulePreviews(
    practiceId,
    insurance?.id,
    chosen.map((option) => Number(option.value)),
  )
  const outcomes = chosen.map((option, index) => ({ code: option.label, answer: previews[index] }))
  const settled = outcomes.every(({ answer }) => answer?.data !== undefined)
  const after = outcomes.flatMap(({ code, answer }) => {
    const rule = answer?.data?.rule
    return rule === null || rule === undefined ? [code] : rule.type === 'Replace' ? [rule.toCode] : []
  })
  const changed = outcomes.filter(({ answer }) => answer?.data?.rule != null).length

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
          <p className="text-micro text-n500 mt-5">Rules are tested against an insurance of this practice.</p>
        ) : outcomes.length === 0 ? (
          <p className="text-micro text-n500 mt-5">
            Choose the codes on a claim to see what the rules do to them.
          </p>
        ) : (
          <div aria-live="polite" className="mt-5">
            <ul aria-label="What the rules do" className="grid gap-3.5">
              {outcomes.map(({ code, answer }) => {
                const rule = answer?.data?.rule ?? null
                return (
                  <li key={code}>
                    <span className="text-meta text-ink block font-medium tabular-nums">
                      {code}
                      {rule !== null && (
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
                      {answer === undefined || answer.isPending ? (
                        <Spinner size={12} />
                      ) : answer.isError ? (
                        <span className="text-critical">
                          {isApiError(answer.error) ? userMessage(answer.error) : 'Could not be checked.'}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            rule !== null && 'font-medium',
                            rule?.type === 'Replace' && 'text-brand-deep',
                            rule?.type === 'Drop' && 'text-sand-deep',
                          )}
                        >
                          {/* The server's words: the rule's summary, or "No rule applies…". */}
                          {answer.data.message ?? (rule === null ? 'No rule applies' : '')}
                        </span>
                      )}
                    </span>
                    {rule !== null && rule.note !== '' && (
                      <span className="text-micro text-n600 mt-0.5 block break-words">{rule.note}</span>
                    )}
                  </li>
                )
              })}
            </ul>

            {settled && (
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
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}

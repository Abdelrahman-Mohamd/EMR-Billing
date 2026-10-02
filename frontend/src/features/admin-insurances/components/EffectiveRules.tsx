import { useWatch } from 'react-hook-form'
import type { ClassRules } from '../model/rules'
import { effectiveRules } from '../model/rules'
import { formRuleOverrides, type InsuranceFormValues } from '../schemas/insurance'

/**
 * The prototype's "Effective values" panel: each rule's value for this
 * insurance, and whether it comes from the class or is overridden here —
 * COALESCE(insurance, class), PRD V2 §10.3. Follows the form as it changes.
 */
export function EffectiveRules({
  classRules,
  className,
}: {
  classRules: ClassRules | null
  className?: string
}) {
  const values = useWatch<InsuranceFormValues>()
  const choices = {
    authorizationRequired: values.authorizationRequired ?? 'inherit',
    injuryDateRequired: values.injuryDateRequired ?? 'inherit',
    applySpecialtyModifiers: values.applySpecialtyModifiers ?? 'inherit',
    acceptAssignment: values.acceptAssignment ?? 'inherit',
    icdVersion: values.icdVersion ?? 'inherit',
  }

  return (
    <section aria-labelledby="effective-rules-title" className={className}>
      <div className="bg-n50 rounded-card border-rule-row border px-4 py-3">
        <h4 id="effective-rules-title" className="text-eyebrow text-n500 mb-2 font-medium uppercase">
          Effective values
        </h4>
        {classRules === null ? (
          <p className="text-micro text-n500">Choose a class to see the effective rules.</p>
        ) : (
          <dl className="text-meta divide-rule-row divide-y">
            {effectiveRules(classRules, formRuleOverrides(choices)).map((rule) => (
              <div key={rule.key} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                <dt className="text-n600 min-w-0 flex-1">{rule.label}</dt>
                <dd className="text-ink font-medium">{rule.value}</dd>
                <dd className="text-micro text-n500 w-full text-right sm:w-32">
                  {rule.source === 'class' ? 'from the class' : 'overridden'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}

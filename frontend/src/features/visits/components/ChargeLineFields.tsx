import { useFormContext } from 'react-hook-form'
import { FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { MultiSelect, SearchSelect } from '@/components/ui/SearchSelect'
import type { ProcedureCode } from '@/features/admin-procedure-codes'

export interface DiagnosisOption {
  /** The pointer: the diagnosis's position on the case, from 1. */
  pointer: number
  code: string
  description: string
}

/**
 * One charge line's fields — procedure code, units, modifiers and diagnosis
 * pointers — as the charge-line payload carries them. Used for each line of a
 * new visit (`prefix` "lines.0.") and on its own when a line is added to a
 * visit (no prefix).
 *
 * Codes offered are the active ones (PRD V2 §10.3: inactive codes cannot be
 * added to new charge lines). Choosing a code whose modifier override is on
 * fills in its modifiers (the override replaces a line's own, client
 * 2026-09-30). Diagnosis pointers are picked from the case's diagnoses, in the
 * order they should print; without a case there is nothing to point at.
 */
export function ChargeLineFields({
  prefix = '',
  codes,
  diagnoses,
}: {
  prefix?: string
  codes: readonly ProcedureCode[]
  diagnoses: readonly DiagnosisOption[] | null
}) {
  const form = useFormContext()
  const name = (field: string) => `${prefix}${field}`
  const active = codes.filter((code) => code.isActive)

  return (
    <>
      <FormField name={name('procedureCode')} label="Procedure code" required span={8}>
        {(field) => (
          <SearchSelect
            value={typeof field.value === 'string' ? field.value : null}
            onChange={(next) => {
              field.onChange(next)
              const code = active.find((item) => item.code === next)
              if (code?.modifierOverride === true)
                form.setValue(name('modifiers'), code.modifiers.join(', '), { shouldDirty: true })
            }}
            options={active.map((code) => ({
              value: code.code,
              label: `${code.code} — ${code.description}`,
            }))}
            placeholder="Select a procedure code"
            searchPlaceholder="Search codes"
          />
        )}
      </FormField>
      <FormField name={name('units')} label="Units" required span={4}>
        {(field) => <Input {...field} placeholder="Enter units" inputMode="numeric" autoComplete="off" />}
      </FormField>
      <FormField
        name={name('modifiers')}
        label="Modifiers"
        span={6}
        info="Up to four, in the order they print on the claim."
      >
        {(field) => (
          <Input
            {...field}
            onChange={(event) => field.onChange(event.target.value.toUpperCase())}
            placeholder="Enter modifiers, e.g. GP, 59"
            autoCapitalize="characters"
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField
        name={name('diagnosisPointers')}
        label="Diagnosis pointers"
        span={6}
        info="The case’s diagnoses this line points to, in the order chosen — the first is the line’s primary."
      >
        {(field) => (
          <MultiSelect
            value={Array.isArray(field.value) ? (field.value as string[]) : []}
            onChange={field.onChange}
            options={(diagnoses ?? []).map((diagnosis) => ({
              value: String(diagnosis.pointer),
              label: `${diagnosis.pointer} · ${diagnosis.code} — ${diagnosis.description}`,
            }))}
            placeholder={diagnoses === null ? 'Select a case first' : 'Select diagnoses'}
            searchPlaceholder="Search diagnoses"
            emptyMessage="The case has no diagnoses."
            disabled={diagnoses === null}
          />
        )}
      </FormField>
    </>
  )
}

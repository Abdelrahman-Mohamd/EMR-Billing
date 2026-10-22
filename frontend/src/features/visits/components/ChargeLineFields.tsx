import { useFormContext } from 'react-hook-form'
import { FormField } from '@/components/ui/Form'
import { Input, Textarea } from '@/components/ui/Input'
import { NOTES_MAX } from '../schemas/visit-form'
import { MultiSelect, SearchSelect } from '@/components/ui/SearchSelect'
import type { ProcedureCode } from '@/features/admin-procedure-codes'

export interface DiagnosisOption {
  /** The pointer: the diagnosis's position on the visit, from 1. */
  pointer: number
  code: string
  description: string
}

/**
 * One charge line's fields — procedure code, units, modifiers, diagnosis
 * pointers, and its own place of service and notes — as the visit's payload
 * and the charge-line payload carry them. Used for each line of a new visit
 * (`prefix` "lines.0.") and on its own to add or edit a visit's line (no
 * prefix).
 *
 * Codes offered are the active ones (PRD V2 §10.3: inactive codes cannot be
 * added to new charge lines) — and a saved line's own code (`keepCodeId`),
 * active or not. Choosing a code whose modifier override is on
 * fills in its modifiers (the override replaces a line's own, client
 * 2026-09-30). Diagnosis pointers are picked from the visit's diagnoses, in the
 * order they should print; without a case there is nothing to point at.
 */
export function ChargeLineFields({
  prefix = '',
  codes,
  diagnoses,
  keepCodeId,
}: {
  prefix?: string
  codes: readonly ProcedureCode[]
  diagnoses: readonly DiagnosisOption[] | null
  /** A saved line's own code: offered even if no longer active. */
  keepCodeId?: number
}) {
  const form = useFormContext()
  const name = (field: string) => `${prefix}${field}`
  const active = codes.filter((code) => code.isActive || code.id === keepCodeId)

  return (
    <>
      <FormField name={name('procedureCode')} label="Procedure code" required span={8}>
        {(field) => (
          <SearchSelect
            value={typeof field.value === 'string' ? field.value : null}
            onChange={(next) => {
              field.onChange(next)
              const code = active.find((item) => String(item.id) === next)
              if (code?.modifierOverride === true)
                form.setValue(name('modifiers'), code.modifiers.join(', '), { shouldDirty: true })
            }}
            options={active.map((code) => ({
              value: String(code.id),
              label: `${code.code} — ${code.description}`,
            }))}
            placeholder="Select a procedure code"
            searchPlaceholder="Search codes"
          />
        )}
      </FormField>
      <FormField name={name('units')} label="Units" required span={4}>
        {(field) => (
          <Input {...field} placeholder="Enter units" inputMode="numeric" autoComplete="off" maxLength={2} />
        )}
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
        info="Up to four of the visit’s diagnoses, in the order chosen — the first is the line’s primary. None chosen: the first diagnosis."
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
            emptyMessage="The visit has no diagnoses."
            disabled={diagnoses === null}
          />
        )}
      </FormField>
      <FormField
        name={name('placeOfService')}
        label="Place of service"
        span={4}
        info="Box 24B, two digits. Left empty, the location’s place of service."
      >
        {(field) => (
          <Input
            {...field}
            placeholder="Enter 2-digit code"
            inputMode="numeric"
            maxLength={2}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField name={name('notes')} label="Notes" span={8}>
        {(field) => (
          <Textarea {...field} rows={1} maxLength={NOTES_MAX} placeholder="Enter a note for this line" />
        )}
      </FormField>
    </>
  )
}

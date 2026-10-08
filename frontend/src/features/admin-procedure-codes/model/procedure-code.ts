import type { SelectOption } from '@/components/ui/Select'

/**
 * The procedure types the server takes, worded as the prototype words them.
 * The prototype offers the first four; `other` is the server's too. A value
 * outside these, if the server ever sends one, is shown with its label and
 * kept when the code is saved.
 */
export const PROCEDURE_TYPES: readonly SelectOption[] = [
  { value: 'evaluation', label: 'Evaluation' },
  { value: 'therapeutic', label: 'Therapeutic' },
  { value: 'modality', label: 'Modality' },
  { value: 'supply_dme', label: 'Supply / DME' },
  { value: 'other', label: 'Other' },
]

export function procedureTypeOptions(current: string | null, currentLabel = ''): readonly SelectOption[] {
  if (current === null || PROCEDURE_TYPES.some((type) => type.value === current)) return PROCEDURE_TYPES
  return [...PROCEDURE_TYPES, { value: current, label: currentLabel || current }]
}

/** The type's name: the server's label, else ours, else the value. */
export function procedureTypeName(code: { procedureType: string; procedureTypeLabel: string }): string {
  return (
    code.procedureTypeLabel ||
    PROCEDURE_TYPES.find((type) => type.value === code.procedureType)?.label ||
    code.procedureType
  )
}

/** The prototype's four modifier inputs — also the server's limit. */
export const MODIFIER_SLOTS = 4

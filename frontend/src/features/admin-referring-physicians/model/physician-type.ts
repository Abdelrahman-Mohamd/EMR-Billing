import type { SelectOption } from '@/components/ui/Select'

/**
 * The physician types PRD V2 defines (`referring_physician.type`, F17, BR48):
 * DN — referring, DQ — supervising. The type sets the Box 17 qualifier.
 *
 * A value outside these two, if the backend ever sends one, is shown as it
 * is and kept when the record is saved — never rewritten to DN.
 */
export const PHYSICIAN_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'DN', label: 'Referring (DN)' },
  { value: 'DQ', label: 'Supervising (DQ)' },
]

/** The prototype's default for a new physician. */
export const DEFAULT_PHYSICIAN_TYPE = 'DN'

export function physicianTypeOptions(current: string | null): readonly SelectOption[] {
  if (current === null || PHYSICIAN_TYPE_OPTIONS.some((option) => option.value === current)) {
    return PHYSICIAN_TYPE_OPTIONS
  }
  return [...PHYSICIAN_TYPE_OPTIONS, { value: current, label: current }]
}

/** The list's short form, as the prototype writes it: "DN · Referring". */
export function physicianTypeLabel(type: string): string {
  if (type === 'DN') return 'DN · Referring'
  if (type === 'DQ') return 'DQ · Supervising'
  return type
}

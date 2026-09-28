import type { SelectOption } from '@/components/ui/Select'

/**
 * The place-of-service codes the approved prototype offers (its `POS_OPTIONS`),
 * with their CMS names. It is the project's only defined list, not a confirmed
 * one: which codes a location may use is still open (Q-079), so this is a
 * starting set, not a rule. PRD V2 §10.2 sets the default to 11.
 *
 * A location saved with a code outside this list keeps it — the select shows
 * the stored code as its own option — so a longer list from the backend
 * replaces this constant without breaking existing records.
 */
export const DEFAULT_PLACE_OF_SERVICE = '11'

export const PLACE_OF_SERVICE_OPTIONS: readonly SelectOption[] = [
  { value: '11', label: '11 — Office' },
  { value: '02', label: '02 — Telehealth (not in patient home)' },
  { value: '10', label: '10 — Telehealth in patient home' },
  { value: '12', label: '12 — Patient home' },
  { value: '22', label: '22 — Outpatient hospital' },
]

export function placeOfServiceOptions(current: string | null): readonly SelectOption[] {
  if (current === null || PLACE_OF_SERVICE_OPTIONS.some((option) => option.value === current)) {
    return PLACE_OF_SERVICE_OPTIONS
  }
  return [...PLACE_OF_SERVICE_OPTIONS, { value: current, label: current }]
}

export function placeOfServiceLabel(code: string | undefined): string | undefined {
  if (code === undefined) return undefined
  return PLACE_OF_SERVICE_OPTIONS.find((option) => option.value === code)?.label ?? code
}

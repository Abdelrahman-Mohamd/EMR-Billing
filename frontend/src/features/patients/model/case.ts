import type { SelectOption } from '@/components/ui/Select'

/**
 * A case — one episode of care — as the screens see it (PRD V2 §3.2, §10.4).
 * Every visit inherits its referring physician, diagnoses, injury type and
 * onset date. The case is the server's (schemas/patient-case.ts); its
 * insurances are the server's too, each ranked on the case (model/coverage.ts).
 */
export interface Diagnosis {
  /** The server's id, as text. */
  id: string
  /** ICD-10-CM, as the server capitals it: "M54.2". */
  code: string
  /** As entered; '' when none. */
  description: string
}

export interface PatientCase {
  /** The server's id, as text. */
  id: string
  patientId: string
  name: string
  /** The referring physician (Setup → Referring physicians). */
  referrerId: number | null
  /** '' — not related to an injury; else `auto`, `employment` or `other`. */
  injuryType: string
  /** As the server words it: "Auto Accident". */
  injuryTypeLabel: string
  /** ISO dates, '' when none. */
  injuryDate: string
  accidentState: string
  startOfCare: string
  dischargeDate: string
  /** Open (true) or closed. */
  isActive: boolean
  /** In the order added: the position is the pointer a new visit copies (Box 21 / 24E). */
  diagnoses: Diagnosis[]
}

/** The server's related causes. */
export const INJURY_TYPES: readonly SelectOption[] = [
  { value: 'employment', label: 'Employment Related' },
  { value: 'auto', label: 'Auto Accident' },
  { value: 'other', label: 'Other' },
]
export const AUTO = 'auto'

/** The cause's name: the server's label, else ours, else ''. */
export function injuryTypeName(item: Pick<PatientCase, 'injuryType' | 'injuryTypeLabel'>): string {
  return (
    item.injuryTypeLabel ||
    INJURY_TYPES.find((type) => type.value === item.injuryType)?.label ||
    item.injuryType
  )
}

/** A case id as the chart's address carries it: a server id as a number, so it reads `?case=20`. */
export const caseSearch = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id)

/** A case holds up to 12 diagnoses — the claim's pointers. */
export const MAX_DIAGNOSES = 12

/** The case a new patient starts with, as the server creates it. */
export const DEFAULT_CASE_NAME = 'Default'

import type { VisitReferences } from '../queries/use-visit-references'
import type { RecordRef } from '../schemas/visit'

/** What a charge line (or a claim made from one) carries, for display. */
export interface LineLike {
  procedureCode: RecordRef
  units: number
  modifiers: readonly string[]
  diagnosisPointers: readonly number[]
}

/** "97110 × 2". */
export const lineCode = (line: LineLike): string => `${String(line.procedureCode)} × ${line.units}`

/** A visit's codes at a glance: "97110 × 2 · 97140". */
export const codesSummary = (lines: readonly LineLike[]): string =>
  lines.map((line) => (line.units === 1 ? String(line.procedureCode) : lineCode(line))).join(' · ')

/** "GP, 59", or empty. */
export const modifiersText = (line: LineLike): string => line.modifiers.join(', ')

/** "1 · M54.50, 2 · G89.29": each pointer with the case's diagnosis it names. */
export function pointersText(line: LineLike, caseId: RecordRef, refs: VisitReferences): string {
  return line.diagnosisPointers
    .map((pointer) => {
      const code = refs.diagnosisAt(caseId, pointer)
      return code === '' ? String(pointer) : `${pointer} · ${code}`
    })
    .join(', ')
}

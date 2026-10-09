import { formatMoney } from '@/lib/utils/money'
import type { VisitReferences } from '../queries/use-visit-references'

/** What a charge line (or a claim made from one) carries, for display. */
export interface LineLike {
  procedureCodeId: number
  units: number
  modifiers: readonly string[]
  diagnosisPointers: readonly number[]
}

/** "97110 × 2". */
export const lineCode = (line: LineLike, refs: VisitReferences): string =>
  `${refs.procedure(line.procedureCodeId).code} × ${line.units}`

/** A visit's codes at a glance: "97110 × 2 · 97140". */
export const codesSummary = (lines: readonly LineLike[], refs: VisitReferences): string =>
  lines
    .map((line) => (line.units === 1 ? refs.procedure(line.procedureCodeId).code : lineCode(line, refs)))
    .join(' · ')

/** "GP, 59", or empty. */
export const modifiersText = (line: LineLike): string => line.modifiers.join(', ')

/**
 * "1 · M54.50, 2 · G89.29": each pointer with the diagnosis it names — in the
 * visit's own copy of the case's diagnoses (`Visit.diagnosisCodes`), which a
 * later change to the case does not touch.
 */
export function pointersText(line: LineLike, diagnosisCodes: readonly string[]): string {
  return line.diagnosisPointers
    .map((pointer) => {
      const code = diagnosisCodes[pointer - 1] ?? ''
      return code === '' ? String(pointer) : `${pointer} · ${code}`
    })
    .join(', ')
}

/** The server's amount ("90.00") as money: "$90.00"; empty when there is none. */
export function amountText(amount: string): string {
  const value = Number(amount)
  return amount === '' || Number.isNaN(value) ? '' : formatMoney(value)
}

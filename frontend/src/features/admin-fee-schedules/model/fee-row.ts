/**
 * A fee-schedule row as the prototype shows and edits it: the billed price per
 * unit of one procedure code for one insurance, between two dates (PRD V2
 * §10.3: billed price only, effective from / to). **Frontend-only:** no
 * backend exists for fee schedules, so this is the screen's own shape, not a
 * contract.
 */
export interface FeeRow {
  /** The insurance's id, from the insurances list. */
  insuranceId: number
  /** The CPT / HCPCS code, from the procedure codes list. */
  procedureCode: string
  /** Billed price per unit, in dollars. */
  billed: number
  /** ISO dates, inclusive. */
  from: string
  to: string
}

/** One row per code and insurance, as in the prototype. */
export function feeRowKey(row: Pick<FeeRow, 'insuranceId' | 'procedureCode'>): string {
  return `${row.insuranceId}:${row.procedureCode}`
}

export interface PriceResult {
  /** Per unit. */
  rate: number
  amount: number
  /** "payer": the insurance's row in effect; "default": the code's default fee. */
  source: 'payer' | 'default'
}

const cents = (value: number) => Math.round(value * 100) / 100

/**
 * The prototype's price lookup, as its card explains it: "the payer's billed
 * price when a row is effective, otherwise the code's default fee", times the
 * units. A row is effective when the date falls between its from and to,
 * inclusive. Nothing else is applied — no allowed amount, no adjustment.
 */
export function lookUpPrice({
  rows,
  insuranceId,
  procedureCode,
  defaultFee,
  units,
  date,
}: {
  rows: readonly FeeRow[]
  insuranceId: number
  procedureCode: string
  defaultFee: number
  units: number
  date: string
}): PriceResult {
  const row = rows.find(
    (candidate) =>
      candidate.insuranceId === insuranceId &&
      candidate.procedureCode === procedureCode &&
      candidate.from <= date &&
      candidate.to >= date,
  )
  const rate = row === undefined ? defaultFee : row.billed
  return { rate, amount: cents(rate * units), source: row === undefined ? 'default' : 'payer' }
}

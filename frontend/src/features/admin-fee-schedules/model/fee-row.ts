/**
 * The prototype's price lookup, over the rows the server sends
 * (schemas/fee-row.ts).
 */

/** What a lookup needs of a row. */
export interface PricedRow {
  insuranceId: number
  procedureCodeId: number
  /** Billed price per unit, in dollars. */
  billed: number
  /** ISO dates, inclusive; no end date is `null`. */
  from: string
  to: string | null
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
 * inclusive — a row with no end date runs on. Nothing else is applied — no
 * allowed amount, no adjustment.
 */
export function lookUpPrice({
  rows,
  insuranceId,
  procedureCodeId,
  defaultFee,
  units,
  date,
}: {
  rows: readonly PricedRow[]
  insuranceId: number
  procedureCodeId: number
  defaultFee: number
  units: number
  date: string
}): PriceResult {
  const row = rows.find(
    (candidate) =>
      candidate.insuranceId === insuranceId &&
      candidate.procedureCodeId === procedureCodeId &&
      candidate.from <= date &&
      (candidate.to === null || candidate.to >= date),
  )
  const rate = row === undefined ? defaultFee : row.billed
  return { rate, amount: cents(rate * units), source: row === undefined ? 'default' : 'payer' }
}

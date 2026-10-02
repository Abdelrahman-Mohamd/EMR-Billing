import type { FeeRow } from '../model/fee-row'

/**
 * TEMPORARY DEVELOPMENT DATA — not records from any system.
 *
 * The prototype's fee-schedule rows, so the screen can be seen with content in
 * development and tests. The insurance ids are the development insurances
 * mock's (`features/admin-insurances/api/insurances-api.mock.ts`), which exists
 * only in the same builds; the codes are the development procedure codes'.
 * Loaded only when `__MOCK_DATA__` is true (see `fee-schedule-store.ts`), so a
 * production build never contains it.
 */
const BILLED: Record<number, Record<string, number>> = {
  // Medicare Part B, Empire BlueCross BlueShield, Aetna, UnitedHealthcare,
  // Corvel Enterprise, GEICO No-Fault (practice 1); Medicare Part B, Aetna (practice 2).
  1: {
    97110: 30,
    97112: 34,
    97116: 29,
    97140: 28,
    97530: 36,
    97535: 32,
    G0283: 16,
    97161: 105,
    97162: 105,
    97163: 105,
    97164: 72,
    97750: 38,
  },
  2: { 97110: 40, 97112: 42, 97116: 38, 97140: 40, 97530: 45, 97161: 150, 97162: 150 },
  3: { 97110: 38, 97112: 40, 97140: 38, 97530: 42, 97535: 38, 97162: 145 },
  4: { 97110: 36, 97112: 38, 97140: 36, 97530: 40, 97161: 140 },
  5: { 97110: 48, 97112: 50, 97140: 46, 97530: 52, 97163: 190, 97750: 60 },
  6: { 97110: 45, 97140: 44, 97530: 50, 97162: 170, 97014: 22 },
  9: { 97110: 30, 97140: 28, 97530: 36, 97116: 29 },
  10: { 97110: 38, 97140: 38, 97530: 42 },
}

export const SAMPLE_FEE_ROWS: readonly FeeRow[] = Object.entries(BILLED).flatMap(([insuranceId, codes]) =>
  Object.entries(codes).map(([procedureCode, billed]) => ({
    insuranceId: Number(insuranceId),
    procedureCode,
    billed,
    from: '2026-01-01',
    to: '2026-12-31',
  })),
)

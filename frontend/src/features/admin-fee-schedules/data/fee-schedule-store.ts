import { useSyncExternalStore } from 'react'
import { feeRowKey, type FeeRow } from '../model/fee-row'

/**
 * WHERE FEE-SCHEDULE ROWS LIVE FOR NOW — a temporary, in-memory store in this
 * browser tab. **There is no backend for fee schedules**, so nothing here
 * calls a server, and nothing pretends to: no endpoint, payload or request.
 *
 * - Changes last until the page reloads; nothing is saved anywhere.
 * - In development and tests it starts with the prototype's rows
 *   (`sample-fee-rows.ts`, loaded only when `__MOCK_DATA__` is true, so a
 *   production build never contains them); otherwise it starts empty.
 * - The screens only use `useFeeSchedules()`. When a backend exists, that
 *   hook is replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5)
 *   and this file is deleted — the screens do not change.
 *
 * Same pattern as `features/admin-procedure-codes/data/procedure-code-store.ts`.
 */
interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  rows: readonly FeeRow[]
}

let snapshot: Snapshot = { ready: !__MOCK_DATA__, rows: [] }
const listeners = new Set<() => void>()

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-fee-rows').then(({ SAMPLE_FEE_ROWS }) => {
    // Something may have been added while the sample loaded; keep it.
    if (!snapshot.ready) publish({ ready: true, rows: [...SAMPLE_FEE_ROWS, ...snapshot.rows] })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export interface FeeSchedulesSource extends Snapshot {
  /** Adds a row, or replaces the one for the same code and insurance. */
  save: (row: FeeRow) => void
  remove: (row: Pick<FeeRow, 'insuranceId' | 'procedureCode'>) => void
}

export function useFeeSchedules(): FeeSchedulesSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ...current,
    save: (row) => {
      const key = feeRowKey(row)
      const exists = snapshot.rows.some((existing) => feeRowKey(existing) === key)
      publish({
        ...snapshot,
        rows: exists
          ? snapshot.rows.map((existing) => (feeRowKey(existing) === key ? row : existing))
          : [...snapshot.rows, row],
      })
    },
    remove: (row) => {
      const key = feeRowKey(row)
      publish({ ...snapshot, rows: snapshot.rows.filter((existing) => feeRowKey(existing) !== key) })
    },
  }
}

/** Tests only: start from a known list. */
export function resetFeeSchedules(rows: readonly FeeRow[]): void {
  publish({ ready: true, rows: [...rows] })
}

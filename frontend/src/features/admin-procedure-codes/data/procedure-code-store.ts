import { useSyncExternalStore } from 'react'
import type { ProcedureCode } from '../model/procedure-code'

/**
 * WHERE PROCEDURE CODES LIVE FOR NOW — a temporary, in-memory store in this
 * browser tab. **There is no backend for procedure codes**, so nothing here
 * calls a server, and nothing pretends to: no endpoint, payload or request.
 *
 * - Changes last until the page reloads; nothing is saved anywhere.
 * - In development and tests it starts with the prototype's sample codes
 *   (`sample-procedure-codes.ts`, loaded only when `__MOCK_DATA__` is true, so
 *   a production build never contains them); otherwise it starts empty.
 * - The screens only use `useProcedureCodes()`. When a backend exists, that
 *   hook is replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5)
 *   and this file is deleted — the screens do not change.
 *
 * Plain `useSyncExternalStore`, not Zustand or TanStack Query: this is not
 * server data, and there is no server to mirror.
 */
interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  codes: readonly ProcedureCode[]
}

let snapshot: Snapshot = { ready: !__MOCK_DATA__, codes: [] }
const listeners = new Set<() => void>()

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-procedure-codes').then(({ SAMPLE_PROCEDURE_CODES }) => {
    // Something may have been added while the sample loaded; keep it.
    if (!snapshot.ready) publish({ ready: true, codes: [...SAMPLE_PROCEDURE_CODES, ...snapshot.codes] })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export interface ProcedureCodesSource extends Snapshot {
  /** Adds a new code, or replaces the one with the same code. */
  save: (code: ProcedureCode) => void
}

export function useProcedureCodes(): ProcedureCodesSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ...current,
    save: (code) => {
      const exists = snapshot.codes.some((existing) => existing.code === code.code)
      publish({
        ...snapshot,
        codes: exists
          ? snapshot.codes.map((existing) => (existing.code === code.code ? code : existing))
          : [...snapshot.codes, code],
      })
    },
  }
}

/** Tests only: start from a known list. */
export function resetProcedureCodes(codes: readonly ProcedureCode[]): void {
  publish({ ready: true, codes: [...codes] })
}

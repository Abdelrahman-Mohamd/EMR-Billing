import { useSyncExternalStore } from 'react'
import type { BillingException } from '../model/billing-exception'

/**
 * WHERE BILLING EXCEPTIONS LIVE FOR NOW — a temporary, in-memory list in this
 * browser tab. **There is no backend for exceptions**, so nothing here calls a
 * server, and nothing pretends to: no endpoint, payload or request. This is
 * architecture only; the screens show no message about it.
 *
 * - Changes last until the page reloads.
 * - In development and tests it starts with the prototype's exceptions
 *   (`sample-exceptions.ts`, loaded only when `__MOCK_DATA__` is true, so a
 *   production build never contains them); otherwise it starts empty.
 * - Exceptions are raised by the server when a record arrives; nothing here
 *   creates one.
 * - The screens only use `useBillingExceptions()`. When a backend exists, that
 *   hook is replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5)
 *   — the list a query, `resolve` the server's re-check after a fix — and this
 *   file is deleted.
 * - Nothing here enforces who may see or resolve an exception: the server
 *   decides that on every request (docs/SECURITY.md §1). No record is logged.
 *
 * Same pattern as the patients, procedure codes and coding rules stores.
 */
interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  exceptions: readonly BillingException[]
}

let snapshot: Snapshot = { ready: !__MOCK_DATA__, exceptions: [] }
const listeners = new Set<() => void>()

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-exceptions').then(({ SAMPLE_EXCEPTIONS }) => {
    if (!snapshot.ready) publish({ ready: true, exceptions: [...SAMPLE_EXCEPTIONS] })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export interface BillingExceptionsSource extends Snapshot {
  /**
   * After a fix: the open exceptions it settles become Resolved, stamped with
   * who and when — the prototype's "Save and re-check", whose re-check belongs
   * to the server once one exists. Returns how many were resolved.
   */
  resolve: (settles: (exception: BillingException) => boolean, by: string | null, at: string) => number
}

export function useBillingExceptions(): BillingExceptionsSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ...current,
    resolve: (settles, by, at) => {
      let count = 0
      const exceptions = snapshot.exceptions.map((exception) => {
        if (exception.status !== 'Open' || !settles(exception)) return exception
        count += 1
        return { ...exception, status: 'Resolved' as const, resolvedAt: at, resolvedBy: by }
      })
      if (count > 0) publish({ ...snapshot, exceptions })
      return count
    },
  }
}

/** Tests only: start from a known list. */
export function resetBillingExceptions(exceptions: readonly BillingException[]): void {
  publish({ ready: true, exceptions: [...exceptions] })
}

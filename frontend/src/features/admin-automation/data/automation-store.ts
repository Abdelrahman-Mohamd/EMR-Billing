import { useSyncExternalStore } from 'react'
import {
  SUBMIT_MANUALLY,
  scheduleLabel,
  type AutomationSettings,
  type ScheduleOption,
} from '../model/schedule'

/**
 * WHERE SUBMISSION & AUTOMATION SETTINGS LIVE FOR NOW — a temporary, in-memory
 * store in this browser tab. **There is no backend for them**, so nothing here
 * calls a server, and nothing pretends to: no endpoint, payload or request. This
 * is architecture only; the screen shows no message about it.
 *
 * - Changes last until the page reloads. Nothing runs on a schedule here and no
 *   claim is submitted: the scheduled job is the server's. `lastScheduledRun`
 *   is only shown, never set.
 * - In development and tests it starts with the prototype's settings
 *   (`sample-automation.ts`, loaded only when `__MOCK_DATA__` is true, so a
 *   production build never contains them); otherwise with no options, Off,
 *   and no run.
 * - The screens only use `useAutomation()`. When a backend exists, that hook
 *   is replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5) and
 *   this file is deleted — the screens do not change.
 * - Nothing here enforces who may change the settings: the server decides
 *   that on every request (docs/SECURITY.md §1).
 *
 * Same pattern as the coding rules, roles and procedure codes stores.
 */
interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  settings: AutomationSettings
}

const EMPTY: AutomationSettings = { schedule: SUBMIT_MANUALLY, options: [], lastScheduledRun: null }

let snapshot: Snapshot = { ready: !__MOCK_DATA__, settings: EMPTY }
const listeners = new Set<() => void>()
let nextId = 1

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-automation').then(({ SAMPLE_AUTOMATION }) => {
    if (!snapshot.ready) publish({ ready: true, settings: structuredClone(SAMPLE_AUTOMATION) })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function update(change: (settings: AutomationSettings) => AutomationSettings): void {
  publish({ ...snapshot, settings: change(snapshot.settings) })
}

export type NewScheduleOption = Pick<ScheduleOption, 'kind' | 'hours' | 'time'>

/** What adding an option did: added it, or found the same one already listed. */
export type AddResult = { added: true; label: string } | { added: false; label: string }

export interface AutomationSource {
  ready: boolean
  settings: AutomationSettings
  /** Save the setting: `SUBMIT_MANUALLY` or an option's id. */
  saveSchedule: (schedule: string) => void
  /** Add an option, unless one with the same name is already listed (as in the prototype). */
  addOption: (option: NewScheduleOption) => AddResult
  /** Remove an option. The one in use is never removed. */
  removeOption: (id: string) => void
}

export function useAutomation(): AutomationSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ...current,
    saveSchedule: (schedule) => update((settings) => ({ ...settings, schedule })),
    addOption: (option) => {
      const label = scheduleLabel(option)
      if (snapshot.settings.options.some((existing) => existing.label === label))
        return { added: false, label }
      update((settings) => ({
        ...settings,
        options: [...settings.options, { ...option, id: `option-${nextId++}`, label }],
      }))
      return { added: true, label }
    },
    removeOption: (id) =>
      update((settings) =>
        settings.schedule === id
          ? settings
          : { ...settings, options: settings.options.filter((option) => option.id !== id) },
      ),
  }
}

/** Tests only: start from known settings. */
export function resetAutomation(settings: AutomationSettings): void {
  publish({ ready: true, settings: structuredClone(settings) })
}

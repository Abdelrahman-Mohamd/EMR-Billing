/**
 * jsdom has no layout and no `matchMedia`. This stands in for it: queries of
 * the form `(min-width: Npx)` / `(max-width: Npx)` are answered against a
 * pretend viewport width — 1280px (desktop) unless a test changes it — and
 * listeners are told when it does.
 *
 *   setViewportWidth(375) // render as a phone
 */
type Listener = (event: MediaQueryListEvent) => void

let width = 1280
const lists = new Set<{ query: string; listeners: Set<Listener> }>()

function evaluate(query: string): boolean {
  const min = /\(min-width:\s*(\d+)px\)/.exec(query)
  const max = /\(max-width:\s*(\d+)px\)/.exec(query)
  if (min?.[1] !== undefined && width < Number(min[1])) return false
  if (max?.[1] !== undefined && width > Number(max[1])) return false
  return true
}

export function installMatchMedia(): void {
  window.matchMedia = (query: string) => {
    const entry = { query, listeners: new Set<Listener>() }
    lists.add(entry)
    return {
      get matches() {
        return evaluate(query)
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: Listener) => entry.listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => entry.listeners.delete(listener),
      addListener: (listener: Listener) => entry.listeners.add(listener),
      removeListener: (listener: Listener) => entry.listeners.delete(listener),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }
}

export function setViewportWidth(next: number): void {
  width = next
  for (const entry of lists) {
    for (const listener of entry.listeners) {
      listener({ matches: evaluate(entry.query), media: entry.query } as MediaQueryListEvent)
    }
  }
}

export function resetViewport(): void {
  setViewportWidth(1280)
}

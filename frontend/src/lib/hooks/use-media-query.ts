import { useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query matches, kept in sync as the window resizes.
 *
 * For choosing *which* component to render when two layouts differ in
 * structure — the desktop rail or the mobile bar and drawer — so only one of
 * them exists in the page (one account menu, one set of landmarks). Styling
 * that only changes size or arrangement stays in Tailwind's responsive
 * classes, never here.
 *
 * Breakpoints are Tailwind's (`md` = 768px, from the approved prototype).
 */
export const DESKTOP_NAV_QUERY = '(min-width: 768px)'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

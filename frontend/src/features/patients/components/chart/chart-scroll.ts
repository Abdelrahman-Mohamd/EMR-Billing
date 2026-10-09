import { useEffect, useRef, useState } from 'react'

/**
 * The chart is one page; these move around it. Each part of the chart is a
 * section with an id (`profile`, `insurance`, `case`, `diagnoses`,
 * `authorizations`), and its menu jumps to them and shows where the reader is.
 */

/** Room above a part jumped to: for the sticky row of pills below 1024px, and a little air. */
export const SCROLL_MARGIN = 'scroll-mt-20 lg:scroll-mt-6'

/** Said by `scrollToSection`, so the menu shows the part asked for. */
const JUMP_EVENT = 'chart:jump'

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scrolls a part of the chart to the top and moves focus to its heading, so
 * keyboard and screen-reader users land where the eye does. The menu marks
 * that part even when the page cannot scroll it to the top — a part near the
 * end, or two side by side (user, 2026-10-09: Diagnoses and Authorizations
 * lit Visits).
 */
export function scrollToSection(id: string) {
  const section = document.getElementById(id)
  if (section === null) return
  window.dispatchEvent(new CustomEvent<string>(JUMP_EVENT, { detail: id }))
  section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  const heading = section.querySelector<HTMLElement>('h2, h3')
  if (heading !== null) {
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }
}

/** The page's scroll area: the app's `<main>`, or the window outside the shell. */
const scrollerOf = (element: HTMLElement): HTMLElement | null => element.closest('main')

/**
 * Which section is being read: the last one whose top has reached the reading
 * line — the top of the scroll area plus `offset` (the sticky menu's height).
 * The last parts of the chart share its last screen and never reach the top,
 * so over the last stretch of scrolling the line slides down to the bottom of
 * the screen: each of them is marked in turn, the last one at the very end
 * (user, 2026-10-09: Diagnoses and Authorizations lit Visits). After a jump
 * from the menu, the part jumped to — through the jump's own scrolling and a
 * reader's small scroll after it — until the reader has scrolled `KEEP_JUMP`
 * away on their own.
 */
/** How far the reader scrolls on their own before a part jumped to stops being marked. */
const KEEP_JUMP = 160

export function useScrollSpy(ids: readonly string[], ready: boolean, offset = 96) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join(' ')
  useEffect(() => {
    if (!ready) return
    const first = document.getElementById(ids[0] ?? '')
    if (first === null) return
    const scroller = scrollerOf(first)
    const target: HTMLElement | Window = scroller ?? window
    const scrolledNow = () => scroller?.scrollTop ?? window.scrollY
    // The part jumped to, and where the reader's own scrolling started from
    // (none yet: the jump's own smooth scrolling is still running).
    let jumped: string | undefined
    let from: number | undefined
    const onJump = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return
      jumped = event.detail
      from = undefined
      setActive(event.detail)
    }
    // The reader's own move. A click on the menu presses first and jumps
    // after, so the jump starts afresh.
    const own = () => {
      if (jumped !== undefined && from === undefined) from = scrolledNow()
    }
    const update = () => {
      if (jumped !== undefined) {
        if (from === undefined || Math.abs(scrolledNow() - from) < KEEP_JUMP) return
        jumped = undefined
      }
      // Nothing laid out (yet): the first part.
      if (first.getBoundingClientRect().height === 0) {
        setActive(ids[0])
        return
      }
      const [height, view, scrolled] =
        scroller === null
          ? [document.documentElement.scrollHeight, window.innerHeight, window.scrollY]
          : [scroller.scrollHeight, scroller.clientHeight, scroller.scrollTop]
      // Over the last stretch (a screen, or the whole page when it is shorter),
      // the reading line slides from `offset` down to the bottom of the screen.
      const remaining = Math.max(0, height - view - scrolled)
      const stretch = Math.min(view - offset, height - view)
      const line =
        offset + (stretch > 0 && remaining < stretch ? (view - offset) * (1 - remaining / stretch) : 0)
      const top = scroller?.getBoundingClientRect().top ?? 0
      let current = ids[0]
      for (const id of ids) {
        const element = document.getElementById(id)
        if (element !== null && element.getBoundingClientRect().top - top <= line) current = id
      }
      setActive(current)
    }
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    update()
    target.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    window.addEventListener(JUMP_EVENT, onJump)
    for (const type of inputs) window.addEventListener(type, own, { passive: true, capture: true })
    return () => {
      target.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener(JUMP_EVENT, onJump)
      for (const type of inputs) window.removeEventListener(type, own, { capture: true })
    }
    // `key` stands for `ids`: a new array with the same ids is the same list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, offset])
  return active
}

/** On arrival with a `#section` in the address, go to it once the chart has drawn. */
export function useScrollToHashOnce(ready: boolean) {
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    const id = window.location.hash.slice(1)
    if (id !== '') requestAnimationFrame(() => scrollToSection(id))
  }, [ready])
}

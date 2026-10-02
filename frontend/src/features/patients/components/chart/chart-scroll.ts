import { useEffect, useRef, useState } from 'react'

/**
 * The chart is one page; these move around it. Each part of the chart is a
 * section with an id (`profile`, `insurance`, `case`, `diagnoses`,
 * `authorizations`), and its menu jumps to them and shows where the reader is.
 */

/** Room above a part jumped to: for the sticky row of pills below 1024px, and a little air. */
export const SCROLL_MARGIN = 'scroll-mt-20 lg:scroll-mt-6'

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scrolls a part of the chart to the top and moves focus to its heading, so
 * keyboard and screen-reader users land where the eye does.
 */
export function scrollToSection(id: string) {
  const section = document.getElementById(id)
  if (section === null) return
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
 * Which section is being read: the last one whose top has reached the top of
 * the scroll area (plus `offset`, the sticky menu's height) — or the last
 * section once the page is scrolled to its end.
 */
export function useScrollSpy(ids: readonly string[], ready: boolean, offset = 96) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join(' ')
  useEffect(() => {
    if (!ready) return
    const first = document.getElementById(ids[0] ?? '')
    if (first === null) return
    const scroller = scrollerOf(first)
    const target: HTMLElement | Window = scroller ?? window
    const update = () => {
      // Nothing laid out (yet): the first part.
      if (first.getBoundingClientRect().height === 0) {
        setActive(ids[0])
        return
      }
      const top = scroller?.getBoundingClientRect().top ?? 0
      let current = ids[0]
      for (const id of ids) {
        const element = document.getElementById(id)
        if (element !== null && element.getBoundingClientRect().top - top <= offset) current = id
      }
      const [height, view, scrolled] =
        scroller === null
          ? [document.documentElement.scrollHeight, window.innerHeight, window.scrollY]
          : [scroller.scrollHeight, scroller.clientHeight, scroller.scrollTop]
      const atEnd = height > view && scrolled + view >= height - 4
      setActive(atEnd ? ids.at(-1) : current)
    }
    update()
    target.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      target.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
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

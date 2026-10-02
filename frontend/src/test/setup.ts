import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { installMatchMedia, resetViewport } from './viewport'

// jsdom has no layout, so the router's scroll restoration has nothing to call.
window.scrollTo = () => {}
// Nor element scrolling: the patient chart's menu jumps between sections.
Element.prototype.scrollIntoView = () => {}
Element.prototype.scrollTo = () => {}

// jsdom has no ResizeObserver; Radix measures a popover's arrow with one.
// Nothing is ever resized in jsdom, so an observer that never fires is exact.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom has no matchMedia either. Every test starts on a desktop-width
// viewport; a test about the phone layout calls setViewportWidth (./viewport).
installMatchMedia()

afterEach(() => {
  cleanup()
  resetViewport()
})

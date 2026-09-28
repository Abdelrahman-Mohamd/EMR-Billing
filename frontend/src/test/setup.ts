import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no layout, so the router's scroll restoration has nothing to call.
window.scrollTo = () => {}

// jsdom has no ResizeObserver; Radix measures a popover's arrow with one.
// Nothing is ever resized in jsdom, so an observer that never fires is exact.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
})

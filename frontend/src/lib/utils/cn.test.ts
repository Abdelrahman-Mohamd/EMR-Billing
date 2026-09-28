import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('lets a caller override a component default', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6')
  })

  it('keeps a size and a colour together — they are different properties', () => {
    // The trap this guards: tailwind-merge reads an unknown `text-*` as a
    // colour, so a named size like `text-meta` used to delete the colour
    // beside it (or be deleted by it) with no warning.
    expect(cn('text-meta', 'text-ink')).toBe('text-meta text-ink')
    expect(cn('text-white/85', 'text-lede')).toBe('text-white/85 text-lede')
  })

  it('still resolves two sizes, and two colours, to the last one', () => {
    expect(cn('text-meta', 'text-micro')).toBe('text-micro')
    expect(cn('text-ink', 'text-n500')).toBe('text-n500')
  })

  it('lets a caller override a size token with its own height', () => {
    // The sign-in button is 50px tall; the kit's default is the 38px control.
    expect(cn('h-control px-4', 'h-[50px]')).toBe('px-4 h-[50px]')
    expect(cn('h-control-sm', 'h-control')).toBe('h-control')
  })

  it('drops falsy values', () => {
    expect(cn('px-4', false, undefined, null, 'py-2')).toBe('px-4 py-2')
  })
})

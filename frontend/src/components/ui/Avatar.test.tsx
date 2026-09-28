import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Avatar, initialsOf } from './Avatar'

describe('Avatar', () => {
  it('uses the first letters of up to two words of the name', () => {
    expect(initialsOf('Ahmed')).toBe('A')
    expect(initialsOf('ahmed mohamed')).toBe('AM')
    expect(initialsOf('  Dana   Whitfield  Jones ')).toBe('DW')
    expect(initialsOf('')).toBe('')
  })

  it('shows initials, a picture when given one, and a person icon without a name', () => {
    const { container, rerender } = render(<Avatar name="Dana Whitfield" />)
    expect(container).toHaveTextContent('DW')
    rerender(<Avatar name="Dana Whitfield" src="/pic.png" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/pic.png')
    rerender(<Avatar />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    // Always decorative: the control around it carries the name.
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})

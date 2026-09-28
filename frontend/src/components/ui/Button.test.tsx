import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Button } from './Button'

describe('Button', () => {
  it('calls its handler when clicked', async () => {
    const onClick = vi.fn()
    renderWithProviders(<Button onClick={onClick}>Release</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Release' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does nothing while loading, so a slow request cannot be submitted twice', async () => {
    const onClick = vi.fn()
    renderWithProviders(
      <Button loading onClick={onClick}>
        Submit
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does nothing when disabled', async () => {
    const onClick = vi.fn()
    renderWithProviders(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not submit a form unless it is asked to', () => {
    renderWithProviders(
      <form aria-label="demo">
        <Button>Plain</Button>
        <Button type="submit">Save</Button>
      </form>,
    )
    expect(screen.getByRole('button', { name: 'Plain' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit')
  })
})

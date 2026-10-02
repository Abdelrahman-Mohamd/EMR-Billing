import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Switch } from './Switch'

function Harness({ initial = true, disabled = false }: { initial?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(initial)
  return (
    <Switch
      label="Active"
      description="Shown in the practice switcher."
      checked={checked}
      onCheckedChange={setChecked}
      disabled={disabled}
    />
  )
}

describe('Switch', () => {
  it('is a named switch that announces its state and its description', () => {
    renderWithProviders(<Harness />)
    const control = screen.getByRole('switch', { name: 'Active' })
    expect(control).toBeChecked()
    expect(control).toHaveAccessibleDescription('Shown in the practice switcher.')
  })

  it('toggles from the switch and from its label', async () => {
    renderWithProviders(<Harness />)
    const control = screen.getByRole('switch', { name: 'Active' })
    await userEvent.click(control)
    expect(control).not.toBeChecked()
    await userEvent.click(screen.getByText('Active'))
    expect(control).toBeChecked()
  })

  it('toggles with Space and Enter', async () => {
    renderWithProviders(<Harness initial={false} />)
    await userEvent.tab()
    const control = screen.getByRole('switch', { name: 'Active' })
    expect(control).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(control).toBeChecked()
    await userEvent.keyboard('{Enter}')
    expect(control).not.toBeChecked()
  })

  it('cannot be changed when disabled', async () => {
    const onCheckedChange = vi.fn()
    renderWithProviders(<Switch label="Active" checked onCheckedChange={onCheckedChange} disabled />)
    await userEvent.click(screen.getByRole('switch', { name: 'Active' }))
    await userEvent.click(screen.getByText('Active'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('offers a field note beside the label, without renaming the switch', () => {
    renderWithProviders(
      <Switch label="Audit required" info="Explained here." checked={false} onCheckedChange={vi.fn()} />,
    )
    expect(screen.getByRole('switch', { name: 'Audit required' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'About Audit required' })).toHaveAccessibleDescription(
      'Explained here.',
    )
  })
})

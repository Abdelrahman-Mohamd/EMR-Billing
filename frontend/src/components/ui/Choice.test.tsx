import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Checkbox, RadioGroup } from './Choice'
import { Field } from './Field'

describe('Checkbox', () => {
  it('toggles from the label as well as the box', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Checkbox label="Do not send batch statements" onChange={onChange} />)
    await userEvent.click(screen.getByText('Do not send batch statements'))
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('reports a partial selection as mixed, not as checked', () => {
    renderWithProviders(<Checkbox label="Select all" indeterminate checked={false} onChange={vi.fn()} />)
    const box = screen.getByRole('checkbox', { name: 'Select all' })
    expect(box).toHaveProperty('indeterminate', true)
    expect(box).not.toBeChecked()
  })

  it('cannot be toggled when disabled', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Checkbox label="Locked" disabled onChange={onChange} />)
    await userEvent.click(screen.getByText('Locked'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('RadioGroup', () => {
  it('is a named group whose arrow keys move the selection', async () => {
    function Harness() {
      const [value, setValue] = useState<'all' | 'mine'>('all')
      return (
        <Field label="Scope" asFieldset>
          <RadioGroup
            name="scope"
            value={value}
            onValueChange={setValue}
            options={[
              { value: 'all', label: 'All practices' },
              { value: 'mine', label: 'This practice only' },
            ]}
          />
        </Field>
      )
    }
    renderWithProviders(<Harness />)

    expect(screen.getByRole('group', { name: 'Scope' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'All practices' })).toBeChecked()

    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'This practice only' })).toBeChecked()
  })

  it('leaves a disabled option alone', async () => {
    const onValueChange = vi.fn()
    renderWithProviders(
      <RadioGroup
        name="source"
        value="manual"
        onValueChange={onValueChange}
        options={[
          { value: 'manual', label: 'Configured manually' },
          { value: 'ai', label: 'Predicted by AI', disabled: true },
        ]}
      />,
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Predicted by AI' }))
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

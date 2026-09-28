import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { MultiSelect, SearchSelect, type SearchSelectOption } from './SearchSelect'

const OPTIONS: SearchSelectOption[] = [
  { value: 'p1', label: 'Northbrook Health', description: 'Commercial' },
  { value: 'p2', label: 'Riverside Mutual', description: 'Commercial' },
  { value: 'p3', label: 'Statewide Care Plan', description: 'Medicaid' },
  { value: 'p4', label: 'Closed Payer', disabled: true },
]

describe('SearchSelect', () => {
  it('opens on click and reports the option that was chosen', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <SearchSelect options={OPTIONS} value={null} onChange={onChange} aria-label="Payer" />,
    )

    await userEvent.click(screen.getByRole('combobox', { name: 'Payer' }))
    await userEvent.click(screen.getByRole('option', { name: /Riverside Mutual/ }))

    expect(onChange).toHaveBeenCalledWith('p2')
  })

  it('narrows the list as you type, and says so when nothing matches', async () => {
    renderWithProviders(<SearchSelect options={OPTIONS} value={null} onChange={vi.fn()} aria-label="Payer" />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Payer' }))

    await userEvent.type(screen.getByRole('searchbox'), 'state')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option')).toHaveTextContent('Statewide Care Plan')

    await userEvent.clear(screen.getByRole('searchbox'))
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No match.')).toBeInTheDocument()
  })

  it('can be driven from the keyboard alone', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <SearchSelect options={OPTIONS} value={null} onChange={onChange} aria-label="Payer" />,
    )

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith('p2')
  })

  it('refuses a disabled option', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <SearchSelect options={OPTIONS} value={null} onChange={onChange} aria-label="Payer" />,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Payer' }))
    await userEvent.click(screen.getByRole('option', { name: /Closed Payer/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows what is selected and clears it', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <SearchSelect options={OPTIONS} value="p1" onChange={onChange} clearable aria-label="Payer" />,
    )
    expect(screen.getByRole('combobox', { name: 'Payer' })).toHaveTextContent('Northbrook Health')
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('lets a keyboard reach the clear control, which is a real button', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <SearchSelect options={OPTIONS} value="p1" onChange={onChange} clearable aria-label="Payer" />,
    )
    await userEvent.tab() // the combobox
    await userEvent.tab() // the clear button inside it
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('MultiSelect', () => {
  it('keeps the panel open while several are ticked, and removes one from its chip', async () => {
    function Harness() {
      const [value, setValue] = useState<string[]>([])
      return <MultiSelect options={OPTIONS} value={value} onChange={setValue} aria-label="Payers" />
    }
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Payers' }))
    await userEvent.click(screen.getByRole('option', { name: /Northbrook Health/ }))
    await userEvent.click(screen.getByRole('option', { name: /Statewide Care Plan/ }))

    // Still open: the list is there after two picks.
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    const trigger = screen.getByRole('combobox', { name: 'Payers' })
    expect(within(trigger).getByText('Northbrook Health')).toBeInTheDocument()
    expect(within(trigger).getByText('Statewide Care Plan')).toBeInTheDocument()

    await userEvent.click(within(trigger).getByRole('button', { name: 'Remove Northbrook Health' }))
    expect(within(trigger).queryByText('Northbrook Health')).not.toBeInTheDocument()
  })
})

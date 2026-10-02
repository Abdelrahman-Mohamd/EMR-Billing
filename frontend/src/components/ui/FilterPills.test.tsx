import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { FilterPills } from './FilterPills'

const OPTIONS = [
  { value: 'A', label: 'Alpha' },
  { value: 'B', label: 'Beta' },
  { value: 'C', label: 'Gamma' },
]

function Harness({ onChange }: { onChange?: (selected: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <FilterPills
      label="Filter by letter"
      options={OPTIONS}
      selected={selected}
      onChange={(next) => {
        setSelected(next)
        onChange?.(next)
      }}
    />
  )
}

describe('FilterPills', () => {
  it('is a named group of toggle buttons that announce their state', async () => {
    renderWithProviders(<Harness />)
    expect(screen.getByRole('group', { name: 'Filter by letter' })).toBeInTheDocument()
    const beta = screen.getByRole('button', { name: 'Beta' })
    expect(beta).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(beta)
    expect(beta).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(beta)
    expect(beta).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the selection in the options’ order, whatever the click order', async () => {
    const changes: string[][] = []
    renderWithProviders(<Harness onChange={(next) => changes.push(next)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Gamma' }))
    await userEvent.click(screen.getByRole('button', { name: 'Alpha' }))
    expect(changes.at(-1)).toEqual(['A', 'C'])
  })

  it('shows a count after the label when given one', () => {
    renderWithProviders(
      <FilterPills
        label="Filter by result"
        options={[{ value: 'A', label: 'Accepted', count: 6 }]}
        selected={[]}
        onChange={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: 'Accepted 6' })).toBeInTheDocument()
  })
})

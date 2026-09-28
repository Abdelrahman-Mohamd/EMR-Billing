import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { DataTable, type Column } from './DataTable'
import { EmptyState } from './States'

interface Row {
  id: string
  name: string
  amount: string
}

const ROWS: Row[] = [
  { id: '1', name: 'Northbrook Health', amount: '$182.40' },
  { id: '2', name: 'Riverside Mutual', amount: '$96.00' },
]

const COLUMNS: ReadonlyArray<Column<Row>> = [
  { key: 'name', header: 'Payer', cell: (row) => row.name, primary: true, sortable: true },
  { key: 'amount', header: 'Amount', cell: (row) => row.amount, align: 'right' },
]

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return renderWithProviders(
    <DataTable caption="Payers" columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} {...props} />,
  )
}

describe('DataTable', () => {
  it('renders the rows it is given, with an accessible name', () => {
    renderTable()
    expect(screen.getByRole('table', { name: 'Payers' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2
    expect(screen.getByText('Riverside Mutual')).toBeInTheDocument()
  })

  it('asks for a new sort instead of reordering the data itself', async () => {
    const onSortChange = vi.fn()
    renderTable({ sort: { key: 'name', direction: 'asc' }, onSortChange })

    const header = screen.getByRole('columnheader', { name: /payer/i })
    expect(header).toHaveAttribute('aria-sort', 'ascending')

    await userEvent.click(within(header).getByRole('button'))
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
  })

  it('selects one row and all rows', async () => {
    const onSelectionChange = vi.fn()
    renderTable({ selectedIds: [], onSelectionChange })

    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!)
    expect(onSelectionChange).toHaveBeenCalledWith(['1'])

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }))
    expect(onSelectionChange).toHaveBeenLastCalledWith(['1', '2'])
  })

  it('opens a row from a named control a keyboard can reach, not from the row itself', async () => {
    const onAction = vi.fn()
    renderTable({ rowAction: { label: (row) => `Open ${row.name}`, onAction } })

    const opener = screen.getByRole('button', { name: 'Open Northbrook Health' })
    await userEvent.tab()
    expect(opener).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onAction).toHaveBeenCalledWith(ROWS[0])
  })

  it('does not open the row when the selection box is ticked', async () => {
    const onAction = vi.fn()
    renderTable({
      selectedIds: [],
      onSelectionChange: vi.fn(),
      rowAction: { label: (row) => `Open ${row.name}`, onAction },
    })
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('shows the empty state instead of an empty grid', () => {
    renderTable({ rows: [], empty: <EmptyState title="No payers yet" /> })
    expect(screen.getByText('No payers yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error with a retry, and never the underlying failure', async () => {
    const onRetry = vi.fn()
    renderTable({ error: true, onRetry })
    expect(screen.getByRole('alert')).toHaveTextContent('This could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows placeholders while loading rather than an empty state', () => {
    renderTable({ loading: true })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/nothing here/i)).not.toBeInTheDocument()
  })
})

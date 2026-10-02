import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { listAuditEntries } from '../api/audit-log-api'
import type { AuditEntry } from '../schemas/audit-entry'

// Only the integration point is faked; the screen, query and table run for real.
vi.mock('../api/audit-log-api', () => ({ listAuditEntries: vi.fn() }))
const listMock = vi.mocked(listAuditEntries)

function entry(index: number, overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `au${index}`,
    at: new Date(Date.now() - index * 60 * 60_000).toISOString(),
    userName: 'Dana Whitfield',
    action: `Action ${index}`,
    detail: '',
    module: 'ADMIN',
    ...overrides,
  }
}

let total: number

beforeEach(() => {
  total = 45
  listMock.mockReset().mockImplementation((query) => {
    const start = (query.page - 1) * query.pageSize
    const count = Math.max(0, Math.min(query.pageSize, total - start))
    return Promise.resolve({
      entries: Array.from({ length: count }, (_, index) => entry(start + index + 1)),
      total,
    })
  })
})

function renderAt(path = '/admin/audit') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.findByRole('table', { name: 'Audit log' })
const lastQuery = () => listMock.mock.calls.at(-1)?.[0]

describe('Admin → Audit log', () => {
  it('lists entries as the prototype does: when, user, action with detail, module — read-only', async () => {
    listMock.mockResolvedValueOnce({
      entries: [
        entry(0, {
          at: new Date().toISOString(),
          userName: 'Keisha Morgan',
          action: 'Appeal submitted',
          detail: 'Payer portal · Medical necessity letter attached',
          module: 'DENIALS',
        }),
      ],
      total: 1,
    })
    renderAt()
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Audit log' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Admin' })).getByRole('link', { name: 'Audit log' }),
    ).toHaveAttribute('data-status', 'active')
    const headers = within(await table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers).toEqual(['When', 'User', 'Action', 'Module'])
    const row = within(await table()).getAllByRole('row')[1] as HTMLElement
    await waitFor(() => expect(row).toHaveTextContent(/Today \d{2}:\d{2}/))
    expect(row).toHaveTextContent('Keisha Morgan')
    expect(row).toHaveTextContent('Appeal submitted')
    expect(row).toHaveTextContent('Payer portal · Medical necessity letter attached')
    expect(within(row).getAllByText('Denial Management').length).toBeGreaterThan(0)
    // Nothing on an entry can be changed or opened.
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('1 entry')).toBeInTheDocument()
  })

  it('asks the server for 20 entries a page and pages through them', async () => {
    renderAt()
    expect(await screen.findByText('Showing 1–20 of 45 entries', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(lastQuery()).toEqual({ search: '', modules: [], page: 1, pageSize: 20 })
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Showing 21–40 of 45 entries')).toBeInTheDocument()
    expect(lastQuery()).toMatchObject({ page: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }))
    expect(await screen.findByText('Showing 41–45 of 45 entries')).toBeInTheDocument()
  })

  it('searches after typing pauses, and filters by any number of modules, back on page 1', async () => {
    renderAt()
    await screen.findByText('Showing 1–20 of 45 entries', {}, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText('Showing 21–40 of 45 entries')

    const search = screen.getByRole('searchbox', { name: 'Search action, detail or user' })
    expect(search).toHaveAttribute('placeholder', 'Search action, detail or user…')
    await userEvent.type(search, 'appeal')
    await waitFor(() => expect(lastQuery()).toMatchObject({ search: 'appeal', page: 1 }))
    // One request for the finished word, not one per letter.
    expect(listMock.mock.calls.filter(([query]) => query.search !== '' && query.search !== 'appeal')).toEqual(
      [],
    )

    const pills = screen.getByRole('group', { name: 'Filter by module' })
    expect(
      within(pills)
        .getAllByRole('button')
        .map((pill) => pill.textContent),
    ).toEqual([
      'Charges',
      'Billing',
      'Payments',
      'Denial Management',
      'AR Follow-up',
      'Patient',
      'Admin',
      'EMR Integration',
      'Month End',
    ])
    await userEvent.click(within(pills).getByRole('button', { name: 'Month End' }))
    await userEvent.click(within(pills).getByRole('button', { name: 'Payments' }))
    await waitFor(() => expect(lastQuery()).toMatchObject({ modules: ['PAYMENTS', 'MONTHEND'], page: 1 }))
    expect(within(pills).getByRole('button', { name: 'Payments' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('explains an empty log', async () => {
    total = 0
    renderAt()
    expect(await screen.findByText('No audit entries yet', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('offers to clear the search and filters when nothing matches', async () => {
    renderAt()
    await screen.findByText('Showing 1–20 of 45 entries', {}, { timeout: 5000 })
    total = 0
    await userEvent.click(screen.getByRole('button', { name: 'Billing' }))
    expect(await screen.findByText('No entries match')).toBeInTheDocument()
    total = 45
    await userEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(await screen.findByText('Showing 1–20 of 45 entries')).toBeInTheDocument()
    expect(lastQuery()).toEqual({ search: '', modules: [], page: 1, pageSize: 20 })
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status', {}, { timeout: 5000 })).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await screen.findByText('Showing 1–20 of 45 entries')).toBeInTheDocument()
  })
})

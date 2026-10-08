import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { getAuditEntry, listAuditEntries } from '../api/audit-log-api'
import type { AuditEntry, AuditEntryDetail, AuditPage } from '../schemas/audit-entry'

// Only the integration point is faked; the screen, query and table run for real.
vi.mock('../api/audit-log-api', () => ({ listAuditEntries: vi.fn(), getAuditEntry: vi.fn() }))
const listMock = vi.mocked(listAuditEntries)
const getMock = vi.mocked(getAuditEntry)

/** The server's page size. */
const PER_PAGE = 15

function entry(index: number, overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: String(index),
    at: new Date(Date.now() - index * 60 * 60_000).toISOString(),
    userName: 'Super Admin',
    action: `Action ${index}`,
    event: 'login',
    detail: '',
    module: 'auth',
    ...overrides,
  }
}

const onePage = (entries: AuditEntry[]): AuditPage => ({
  entries,
  page: 1,
  pageCount: 1,
  total: entries.length,
  from: 1,
  to: entries.length,
})

let total: number

function serverPage(page: number): AuditPage {
  const start = (page - 1) * PER_PAGE
  const count = Math.max(0, Math.min(PER_PAGE, total - start))
  return {
    entries: Array.from({ length: count }, (_, index) => entry(start + index + 1)),
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
    total,
    from: count === 0 ? 0 : start + 1,
    to: start + count,
  }
}

beforeEach(() => {
  total = 35
  listMock.mockReset().mockImplementation((query) => Promise.resolve(serverPage(query.page)))
  getMock.mockReset()
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

const table = () => screen.findByRole('table', { name: 'Audit log' }, { timeout: 5000 })
const lastQuery = () => listMock.mock.calls.at(-1)?.[0]

describe('Admin → Audit log', () => {
  it('lists entries: when, user, action with detail, module — read-only', async () => {
    listMock.mockResolvedValueOnce(
      onePage([entry(0, { at: new Date().toISOString(), action: 'Logged in', detail: 'IP 104.232.37.17' })]),
    )
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
    expect(row).toHaveTextContent('Super Admin')
    expect(row).toHaveTextContent('Logged in')
    expect(row).toHaveTextContent('IP 104.232.37.17')
    expect(within(row).getAllByText('Authentication').length).toBeGreaterThan(0)
    // The row opens its details and nothing else: no link, no edit.
    expect(within(row).getAllByRole('button')).toHaveLength(1)
    expect(within(row).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('1 entry')).toBeInTheDocument()
    // No search or module filter: the endpoint has neither.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter by module' })).not.toBeInTheDocument()
  })

  it('says when no one was signed in, and shows a log name it does not know as sent, capitalised', async () => {
    listMock.mockResolvedValueOnce(
      onePage([
        entry(0, {
          userName: '',
          action: 'Failed login attempt',
          detail: 'someone@example.test · IP 104.232.37.17',
        }),
        entry(1, { module: 'billing' }),
      ]),
    )
    renderAt()
    await waitFor(async () => expect(within(await table()).getAllByRole('row')).toHaveLength(3))
    const rows = within(await table()).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('No user')
    expect(rows[1]).toHaveTextContent('someone@example.test · IP 104.232.37.17')
    expect(within(rows[2] as HTMLElement).getAllByText('Billing').length).toBeGreaterThan(0)
  })

  it('pages as the server does, 15 at a time', async () => {
    renderAt()
    expect(await screen.findByText('Showing 1–15 of 35 entries', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(lastQuery()).toEqual({ page: 1 })
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Showing 16–30 of 35 entries')).toBeInTheDocument()
    expect(lastQuery()).toEqual({ page: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }))
    expect(await screen.findByText('Showing 31–35 of 35 entries')).toBeInTheDocument()
  })

  it('explains an empty log', async () => {
    total = 0
    renderAt()
    expect(await screen.findByText('No audit entries yet', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status', {}, { timeout: 5000 })).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await screen.findByText('Showing 1–15 of 35 entries')).toBeInTheDocument()
  })

  it('opens an entry in full in a side panel, and goes back to the same page', async () => {
    const detail: AuditEntryDetail = {
      ...entry(17, { at: '2026-10-07T15:16:52.000Z', action: 'Updated user' }),
      user: { name: 'Super Admin', email: 'admin@billing.test' },
      properties: [{ key: 'ip_address', label: 'IP address', value: '104.232.37.17' }],
      record: 'User #4',
      batch: '',
      changes: [{ field: 'name', label: 'Name', before: 'Old Name', after: 'New Name' }],
    }
    getMock.mockResolvedValue(detail)
    renderAt()
    await screen.findByText('Showing 1–15 of 35 entries', {}, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText('Showing 16–30 of 35 entries')

    await userEvent.click(screen.getByRole('button', { name: /^Action 17, .*: view details$/ }))
    const panel = await screen.findByRole('dialog', { name: 'Action 17' })
    expect(getMock).toHaveBeenCalledWith('17', expect.anything())
    expect(await within(panel).findByText('admin@billing.test')).toBeInTheDocument()
    const when = new Date('2026-10-07T15:16:52.000Z')
    const pad = (value: number) => String(value).padStart(2, '0')
    expect(panel).toHaveTextContent(
      `${pad(when.getMonth() + 1)}/${pad(when.getDate())}/${when.getFullYear()} ${pad(when.getHours())}:${pad(when.getMinutes())}:52`,
    )
    expect(panel).toHaveTextContent('User #4')
    expect(panel).toHaveTextContent('IP address')
    expect(panel).toHaveTextContent('104.232.37.17')
    expect(within(panel).getByRole('heading', { name: 'Changes' })).toBeInTheDocument()
    const change = within(within(panel).getByRole('table', { name: 'Changes' })).getAllByRole('row')[1]
    expect(change).toHaveTextContent('Name')
    expect(change).toHaveTextContent('Old Name')
    expect(change).toHaveTextContent('New Name')
    // Nothing in it can change the entry.
    expect(
      within(panel)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Close'])

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Showing 16–30 of 35 entries')).toBeInTheDocument()
  })

  it('says when an entry is gone, and offers a retry for any other failure', async () => {
    getMock.mockRejectedValueOnce(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: /^Action 1, .*: view details$/ }, { timeout: 5000 }),
    )
    expect(
      await within(await screen.findByRole('dialog')).findByText('This entry could not be found'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    getMock.mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    getMock.mockResolvedValueOnce({
      ...entry(2),
      user: null,
      properties: [],
      record: '',
      batch: '',
      changes: [],
    })
    await userEvent.click(screen.getByRole('button', { name: /^Action 2, .*: view details$/ }))
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    const panel = await screen.findByRole('dialog', { name: 'Action 2' })
    expect(await within(panel).findByText('No user')).toBeInTheDocument()
    expect(within(panel).queryByRole('heading', { name: 'Changes' })).not.toBeInTheDocument()
  })
})

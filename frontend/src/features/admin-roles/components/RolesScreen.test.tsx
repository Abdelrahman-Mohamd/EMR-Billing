import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { resetRoles } from '../data/role-store'
import { permissionsFrom } from '../model/permissions'
import type { Role } from '../model/role'

// Frontend only: there is no api to fake. Each test starts the in-tab store
// from a known list.
const role = (overrides: Partial<Role> & { id: string; name: string }): Role => ({
  code: overrides.id,
  description: '',
  kind: 'custom',
  isGlobal: false,
  permissions: permissionsFrom({}),
  userCount: 0,
  ...overrides,
})

beforeEach(() => {
  resetRoles([
    role({
      id: 'SYSTEM_ADMIN',
      name: 'System Admin',
      description: 'All modules, all flags, every practice.',
      kind: 'system',
      isGlobal: true,
      permissions: permissionsFrom('*'),
      userCount: 1,
    }),
    role({
      id: 'PRACTICE_ADMIN',
      name: 'Practice Admin',
      description: 'Runs billing for the practices granted to the user.',
      kind: 'system',
      permissions: permissionsFrom({ DASHBOARD: 'R', PATIENT: 'CRUD', BILLING: 'CRU' }),
      userCount: 3,
    }),
    role({
      id: 'BILLING_VIEWER',
      name: 'Billing Viewer',
      description: 'View on billing modules.',
      permissions: permissionsFrom({ DASHBOARD: 'R', BILLING: 'R' }),
      userCount: 1,
    }),
    role({
      id: 'PAYMENT_POSTER',
      name: 'Payment poster',
      kind: 'standard',
      permissions: permissionsFrom({ PAYMENTS: 'CRU' }),
    }),
  ])
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/roles') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return router
}

const roleList = () => screen.findByRole('navigation', { name: 'Roles' }, { timeout: 5000 })
const matrix = (name: string) => screen.findByRole('table', { name: `Permissions of ${name}` })
const access = (table: HTMLElement, module: string) =>
  within(table).getByRole('radiogroup', { name: `${module} access` })
const rowOf = (table: HTMLElement, module: string) =>
  within(table).getByRole('rowheader', { name: module }).closest('tr') as HTMLElement

describe('Admin → Roles & permissions', () => {
  it('lists the roles with their kind and users, and opens on Practice Admin', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Roles & permissions' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const list = await roleList()
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'System Admin1 user',
      'Practice Admin3 users',
      'Payment poster0 users',
      'Billing Viewer1 user',
    ])
    // Grouped by kind: the kind is said once, by the group.
    expect(
      within(list)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(['System roles', 'Standard roles', 'Custom roles'])
    expect(within(list).getByRole('link', { name: /Practice Admin/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('heading', { level: 2, name: 'Practice Admin' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Limits beyond the flags' })).not.toBeInTheDocument()
    // A one-line summary of the role's access, with the explanation behind an info icon.
    const summary = screen.getByText('Across 11 modules:').parentElement as HTMLElement
    expect(summary).toHaveTextContent('Across 11 modules:Edit 2View 1Hidden 8')
    await userEvent.click(within(summary).getByRole('button', { name: 'About access levels' }))
    expect(
      (await screen.findAllByText(/Edit lets the role create, view and update records/)).length,
    ).toBeGreaterThan(0)
    // Architecture only: nothing on screen talks about where the data lives.
    expect(screen.queryByText(/backend|not saved|temporary|demo|coming soon|mock/i)).not.toBeInTheDocument()
  })

  it('shows each module’s level, Delete tick and flags', async () => {
    renderAt('/admin/roles?role=BILLING_VIEWER')
    const table = await matrix('Billing Viewer')
    expect(within(access(table, 'Billing')).getByRole('radio', { name: 'View' })).toBeChecked()
    expect(within(access(table, 'Payments')).getByRole('radio', { name: 'Hidden' })).toBeChecked()
    expect(rowOf(table, 'Billing')).toHaveTextContent('Flags: R')
    expect(rowOf(table, 'Payments')).toHaveTextContent('Flags: —')
    // Delete only under Edit.
    expect(within(table).getByRole('checkbox', { name: 'Delete Billing' })).toBeDisabled()
  })

  it('selects a role from the list and keeps it in the URL', async () => {
    const router = renderAt()
    await userEvent.click(within(await roleList()).getByRole('link', { name: /Billing Viewer/ }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Billing Viewer' })).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ role: 'BILLING_VIEWER' })
    expect(screen.queryByRole('heading', { name: 'Limits beyond the flags' })).not.toBeInTheDocument()
  })

  it('falls back to Practice Admin for a role that is not there', async () => {
    renderAt('/admin/roles?role=GONE')
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Practice Admin' }, { timeout: 5000 }),
    ).toBeVisible()
  })

  it('shows a system role locked, with no Delete role', async () => {
    renderAt('/admin/roles?role=SYSTEM_ADMIN')
    const table = await matrix('System Admin')
    expect(screen.getByText('All modules, all flags, every practice.')).toBeVisible()
    expect(screen.getByText('Global: sees every practice')).toBeVisible()
    for (const radio of within(table).getAllByRole('radio')) expect(radio).toBeDisabled()
    for (const box of within(table).getAllByRole('checkbox')) expect(box).toBeDisabled()
    expect(
      screen.getByText('System roles cannot be changed. Create a custom role to adjust permissions.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Delete role' })).not.toBeInTheDocument()
  })

  it('changes a level at once and says so; Delete becomes available under Edit', async () => {
    renderAt('/admin/roles?role=BILLING_VIEWER')
    const table = await matrix('Billing Viewer')
    await userEvent.click(within(access(table, 'Billing')).getByRole('radio', { name: 'Edit' }))

    expect(within(access(table, 'Billing')).getByRole('radio', { name: 'Edit' })).toBeChecked()
    expect(rowOf(table, 'Billing')).toHaveTextContent('Flags: C R U')
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        tone: 'success',
        title: 'Billing Viewer: Billing set to Edit',
        description: 'Applies immediately to every user holding this role.',
      }),
    ])

    const deleteBilling = within(table).getByRole('checkbox', { name: 'Delete Billing' })
    expect(deleteBilling).toBeEnabled()
    await userEvent.click(deleteBilling)
    expect(rowOf(table, 'Billing')).toHaveTextContent('Flags: C R U D')
    // The tick changes the flags without a message.
    expect(useToastStore.getState().toasts).toHaveLength(1)

    // Leaving Edit clears Delete.
    await userEvent.click(within(access(table, 'Billing')).getByRole('radio', { name: 'Hidden' }))
    expect(rowOf(table, 'Billing')).toHaveTextContent('Flags: —')
    expect(within(table).getByRole('checkbox', { name: 'Delete Billing' })).not.toBeChecked()
  })

  it('creates a role from a copy of another and opens it', async () => {
    const router = renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New role' }, { timeout: 5000 }))
    const dialog = screen.getByRole('dialog', { name: 'New role' })
    expect(within(dialog).getByText('Adding a role is a data change, not a schema change.')).toBeVisible()
    const name = within(dialog).getByRole('textbox', { name: /role name/i })
    expect(name).toHaveAttribute('placeholder', 'Enter role name')

    // Required, and unique ignoring case.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create role' }))
    expect(await within(dialog).findByText('Enter the role name.')).toBeVisible()
    await userEvent.type(name, 'billing viewer')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create role' }))
    expect(await within(dialog).findByText('A role with this name exists.')).toBeVisible()

    // Only roles that are not global can be copied; the first is chosen.
    const from = within(dialog).getByRole('combobox', { name: /start from/i })
    expect(from).toHaveTextContent('Copy of Practice Admin')
    await userEvent.click(from)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Copy of Practice Admin',
      'Copy of Billing Viewer',
      'Copy of Payment poster',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Copy of Billing Viewer' }))

    await userEvent.clear(name)
    await userEvent.type(name, 'Denials lead')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create role' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { level: 2, name: 'Denials lead' })).toBeInTheDocument()
    expect(screen.getByText('Custom role based on Billing Viewer.')).toBeVisible()
    expect(router.state.location.search).toEqual({ role: 'DENIALS_LEAD' })
    expect(within(await roleList()).getByRole('link', { name: /Denials lead/ })).toHaveTextContent(
      'Denials lead0 users',
    )
    expect(within(screen.getByRole('region', { name: 'Denials lead' })).getByText('Custom')).toBeVisible()
    const table = await matrix('Denials lead')
    expect(within(access(table, 'Billing')).getByRole('radio', { name: 'View' })).toBeChecked()
    expect(within(access(table, 'Billing')).getByRole('radio', { name: 'View' })).toBeEnabled()
  })

  it('does not delete a role users hold', async () => {
    renderAt('/admin/roles?role=BILLING_VIEWER')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete role' }, { timeout: 5000 }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        tone: 'warning',
        title: 'This role is assigned to users',
        description: 'Remove it from every user first.',
      }),
    ])
  })

  it('deletes a role no user holds, after asking, and goes back to Practice Admin', async () => {
    const router = renderAt('/admin/roles?role=PAYMENT_POSTER')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete role' }, { timeout: 5000 }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete Payment poster?' })
    expect(within(confirm).getByText('The role and its permissions are removed.')).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete role' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Practice Admin' })).toBeInTheDocument()
    expect(within(await roleList()).queryByRole('link', { name: /Payment poster/ })).not.toBeInTheDocument()
    expect(router.state.location.search).toEqual({})
  })

  it('shows an empty state, and no New role, when there are no roles', async () => {
    resetRoles([])
    renderAt()
    expect(await screen.findByText('No roles yet', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'New role' })).not.toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { setViewportWidth } from '@/test/viewport'

// The phone layout, through the real router and the development mocks.

function renderApp(path = '/admin/users') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const menuButton = () => screen.findByRole('button', { name: 'Open navigation menu' }, { timeout: 5000 })

beforeEach(() => {
  setViewportWidth(375)
})

describe('navigation on a phone', () => {
  it('replaces the rail with a top bar: menu button, logo, account', async () => {
    renderApp()
    await menuButton()
    expect(screen.getByRole('link', { name: 'EMR Billing — home' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^Account/ }, { timeout: 5000 })).toBeInTheDocument()
    // No rail: the main navigation lives in the drawer until it is opened.
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Expand the sidebar' })).not.toBeInTheDocument()
  })

  it('opens a drawer with every module and the Admin sections under Admin, the current one marked', async () => {
    renderApp()
    await userEvent.click(await menuButton())
    const drawer = await screen.findByRole('dialog', { name: 'Navigation menu' })
    const nav = within(drawer).getByRole('navigation', { name: 'Main' })
    for (const name of [
      'Home',
      'Admin',
      'Organizations',
      'Practices & locations',
      'Users',
      'Referring physicians',
    ]) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('data-status', 'active')
    expect(within(nav).getByRole('link', { name: 'Admin' })).toHaveAttribute('data-status', 'active')
  })

  it('closes when a link is followed, and goes there', async () => {
    const { router } = renderApp()
    await userEvent.click(await menuButton())
    const drawer = await screen.findByRole('dialog', { name: 'Navigation menu' })
    await userEvent.click(within(drawer).getByRole('link', { name: 'Organizations' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/organizations'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes with its close button or Escape, and returns focus to the menu button', async () => {
    renderApp()
    const button = await menuButton()
    await userEvent.click(button)
    await userEvent.click(await screen.findByRole('button', { name: 'Close navigation menu' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(button).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(button).toHaveFocus()
  })

  it('opens the account menu from the top bar', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: /^Account/ }, { timeout: 5000 }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Change password' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('switches to the rail when the window becomes wide enough, and back', async () => {
    renderApp()
    await menuButton()
    act(() => setViewportWidth(1024))
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).not.toBeInTheDocument()
    act(() => setViewportWidth(390))
    expect(await menuButton()).toBeInTheDocument()
  })
})

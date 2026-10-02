import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { createTestQueryClient, renderWithProviders } from '@/test/render'

/**
 * The pattern for a route test: build the real router on a memory history, so
 * the route's loader, context and component are exercised the way they will be
 * in the browser. Copy this file when adding the first feature route.
 */
function renderRoute(path: string) {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  return renderWithProviders(<RouterProvider router={router} />, { queryClient })
}

function renderRouteWithRouter(path: string) {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

describe('application shell', () => {
  it('opens Patients from the start address', async () => {
    const { router } = renderRouteWithRouter('/')
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patients' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/patients')
  }, 10_000)

  it('shows a not-found page instead of a blank screen for an unknown address', async () => {
    renderRoute('/no-such-page')
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })

  it('puts the navigation rail around every screen — the production modules only', async () => {
    renderRoute('/')
    await screen.findByRole('heading', { level: 1, name: 'Patients' }, { timeout: 5000 })
    const nav = screen.getByRole('navigation', { name: 'Main' })
    // The rail's links are named by their labels (icons only while it is collapsed).
    for (const name of ['Patients', 'Exceptions', 'Setup', 'Admin'])
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    // The development pages are never in the navigation.
    // (The logo, "EMR Billing — home", still leads to the start: Patients.)
    expect(within(nav).queryByRole('link', { name: 'Home' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Components' })).not.toBeInTheDocument()
  })

  it('loads the development component showcase behind its own route', async () => {
    renderRoute('/dev/ui')
    // The page is a dynamic import, so this waits on a module load, not a race:
    // the default one second is not enough while the whole suite is warming up.
    expect(
      await screen.findByRole('heading', { name: /component showcase/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})

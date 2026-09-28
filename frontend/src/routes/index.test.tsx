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

describe('application shell', () => {
  it('renders the landing route', async () => {
    renderRoute('/')
    expect(await screen.findByRole('heading', { name: /frontend foundation/i })).toBeInTheDocument()
  })

  it('shows a not-found page instead of a blank screen for an unknown address', async () => {
    renderRoute('/no-such-page')
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })

  it('puts the navigation rail around every screen', async () => {
    renderRoute('/')
    await screen.findByRole('heading', { name: /frontend foundation/i })
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument()
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

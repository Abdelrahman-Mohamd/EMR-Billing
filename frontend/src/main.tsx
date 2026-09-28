import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import './styles/index.css'
// Parse and validate configuration before anything renders, so a missing or
// misspelled variable fails at boot rather than on whichever screen first
// happens to read it (docs/SECURITY.md "Configuration and build").
import '@/lib/config/env'
import { AppProviders } from '@/app/providers/app-providers'
import { queryClient } from '@/lib/query/query-client'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // A preloaded route's data is reused rather than refetched on navigation.
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)

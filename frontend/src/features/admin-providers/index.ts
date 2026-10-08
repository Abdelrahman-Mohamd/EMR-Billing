/**
 * Public surface of Setup → Providers. Routes import from here only
 * (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { ProvidersScreen } from './components/ProvidersScreen'
// Exceptions: a session's missing rendering NPI is fixed on the provider.
export { useCorrectProviderNpi, useProviders } from './queries/use-providers'
export { providerName } from './model/provider-options'
export type { Provider } from './schemas/provider'

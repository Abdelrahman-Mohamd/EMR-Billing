/**
 * Public surface of Admin → Organizations. Routes and other features import
 * from here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { OrganizationsScreen } from './components/OrganizationsScreen'
// Practices point at an organization (`organization_id`) and show its name.
export { useOrganizations } from './queries/use-organizations'
export type { Organization } from './schemas/organization'

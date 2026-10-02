import { permissionsFrom } from '../model/permissions'
import type { Role } from '../model/role'

/**
 * TEMPORARY DEVELOPMENT DATA — not records from any system.
 *
 * The prototype's roles, so the screen can be seen with content in development
 * and tests: PRD V2's two seeded roles (System Admin, Practice Admin) and the
 * prototype's four others, with the prototype's user counts. Loaded only when
 * `__MOCK_DATA__` is true (see `role-store.ts`), so a production build never
 * contains it.
 */
export const SAMPLE_ROLES: readonly Role[] = [
  {
    id: 'SYSTEM_ADMIN',
    code: 'SYSTEM_ADMIN',
    name: 'System Admin',
    description: 'All modules, all flags, every practice.',
    kind: 'system',
    isGlobal: true,
    permissions: permissionsFrom('*'),
    userCount: 1,
  },
  {
    id: 'PRACTICE_ADMIN',
    code: 'PRACTICE_ADMIN',
    name: 'Practice Admin',
    description: 'Runs billing for the practices granted to the user.',
    kind: 'system',
    isGlobal: false,
    permissions: permissionsFrom({
      DASHBOARD: 'R',
      PATIENT: 'CRUD',
      CHARGES: 'CRUD',
      BILLING: 'CRU',
      PAYMENTS: 'CRU',
      DENIALS: 'CRU',
      AR: 'CRU',
      REPORTS: 'R',
      MONTHEND: 'CR',
      ADMIN: 'CRU',
      INTEGRATION: 'R',
    }),
    userCount: 3,
  },
  {
    id: 'ORG_ADMIN',
    code: 'ORG_ADMIN',
    name: 'Organization Admin',
    description: 'All modules across the organization’s practices.',
    kind: 'standard',
    isGlobal: false,
    permissions: permissionsFrom('*'),
    userCount: 1,
  },
  {
    id: 'DOMAIN_ADMIN',
    code: 'DOMAIN_ADMIN',
    name: 'Domain Admin',
    description:
      'Requests EMR integration for locations and chooses which locations bill through the platform.',
    kind: 'standard',
    isGlobal: false,
    permissions: permissionsFrom({ DASHBOARD: 'R', ADMIN: 'R', INTEGRATION: 'CRU' }),
    userCount: 1,
  },
  {
    id: 'BILLING_VIEWER',
    code: 'BILLING_VIEWER',
    name: 'Billing Viewer',
    description: 'Example custom role: View on billing modules, Hidden on Admin and Month End.',
    kind: 'custom',
    isGlobal: false,
    permissions: permissionsFrom({
      DASHBOARD: 'R',
      PATIENT: 'R',
      CHARGES: 'R',
      BILLING: 'R',
      PAYMENTS: 'R',
      DENIALS: 'R',
      AR: 'R',
      REPORTS: 'R',
    }),
    userCount: 1,
  },
  {
    id: 'EMR_SERVICE',
    code: 'EMR_SERVICE',
    name: 'EMR import (service)',
    description: 'Service account role used by the EMR ingestion pipeline.',
    kind: 'custom',
    isGlobal: false,
    permissions: permissionsFrom({ PATIENT: 'CRU', CHARGES: 'CRU' }),
    userCount: 2,
  },
]

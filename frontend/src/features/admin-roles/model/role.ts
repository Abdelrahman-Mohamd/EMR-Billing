import type { Permissions } from './permissions'

/**
 * A role as the prototype shows it — the screen's own shape (frontend-only;
 * see `permissions.ts`).
 *
 * - `kind`: the prototype's "System role" (PRD V2 seeds two; they cannot be
 *   changed), "Custom" (made here) or "Standard".
 * - `isGlobal`: sees every practice (PRD V2 `role.is_global`).
 * - `userCount`: how many users hold the role. The prototype counts the users'
 *   roles; nothing here assigns roles to users yet, so it is carried as a
 *   number, and a new role starts at 0.
 */
export interface Role {
  id: string
  /** PRD V2 `role.code`, e.g. PRACTICE_ADMIN. */
  code: string
  name: string
  description: string
  kind: 'system' | 'custom' | 'standard'
  isGlobal: boolean
  permissions: Permissions
  userCount: number
}

export const ROLE_KIND_LABEL: Record<Role['kind'], string> = {
  system: 'System role',
  custom: 'Custom',
  standard: 'Standard',
}

/** The prototype names a new role's code from its name: capitals, words joined by "_". */
export function roleCodeFrom(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\W+/g, '_')
    .replace(/^_+|_+$/g, '')
}

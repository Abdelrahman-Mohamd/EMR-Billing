/**
 * Roles and permissions as the prototype shows them. **Frontend-only:** no
 * backend exists for roles or permissions, so this is the screen's own shape,
 * not a contract.
 *
 * The permission model is PRD V2's: create / read / update / delete per role
 * and module (`role.permissions {MODULE:{c,r,u,d}}`, §10.2). The prototype
 * shows it the way chapter 1 describes access — Edit / View / Hidden — and maps
 * one to the other (open contradiction C-001):
 * - **Edit** = create, read, update; Delete is a separate tick, only under Edit.
 * - **View** = read only.
 * - **Hidden** = nothing.
 */

/** The modules a role sets access for — the prototype's list, in its order. */
export const MODULES = [
  { key: 'DASHBOARD', label: 'Dashboard' },
  { key: 'PATIENT', label: 'Patient' },
  { key: 'CHARGES', label: 'Charges' },
  { key: 'BILLING', label: 'Billing' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'DENIALS', label: 'Denial Management' },
  { key: 'AR', label: 'AR Follow-up' },
  { key: 'REPORTS', label: 'Reports' },
  { key: 'MONTHEND', label: 'Month End' },
  { key: 'ADMIN', label: 'Admin' },
  { key: 'INTEGRATION', label: 'EMR Integration' },
] as const

export type ModuleKey = (typeof MODULES)[number]['key']

export interface Flags {
  c: boolean
  r: boolean
  u: boolean
  d: boolean
}

export type Permissions = Record<ModuleKey, Flags>

export type AccessLevel = 'edit' | 'view' | 'hidden'

export const ACCESS_LEVELS = [
  { value: 'edit', label: 'Edit' },
  { value: 'view', label: 'View' },
  { value: 'hidden', label: 'Hidden' },
] as const satisfies ReadonlyArray<{ value: AccessLevel; label: string }>

export function accessLevelLabel(level: AccessLevel): string {
  return ACCESS_LEVELS.find((option) => option.value === level)?.label ?? level
}

/** The prototype's reading of the flags. */
export function levelOf(flags: Flags): AccessLevel {
  return flags.c || flags.u ? 'edit' : flags.r ? 'view' : 'hidden'
}

/** The flags a level sets. Edit keeps the Delete tick as it was; the others clear it. */
export function withLevel(flags: Flags, level: AccessLevel): Flags {
  if (level === 'edit') return { c: true, r: true, u: true, d: flags.d }
  if (level === 'view') return { c: false, r: true, u: false, d: false }
  return { c: false, r: false, u: false, d: false }
}

/** "C R U D", or "—" when the role has no access. */
export function flagLetters(flags: Flags): string {
  const letters = (['c', 'r', 'u', 'd'] as const).filter((key) => flags[key]).map((key) => key.toUpperCase())
  return letters.length > 0 ? letters.join(' ') : '—'
}

/** Builds a permission set from per-module letters, e.g. `{ BILLING: 'CRU' }`; `'*'` is every flag everywhere. */
export function permissionsFrom(spec: '*' | Partial<Record<ModuleKey, string>>): Permissions {
  return Object.fromEntries(
    MODULES.map(({ key }) => {
      const letters = spec === '*' ? 'CRUD' : (spec[key] ?? '')
      return [
        key,
        {
          c: letters.includes('C'),
          r: letters.includes('R'),
          u: letters.includes('U'),
          d: letters.includes('D'),
        },
      ]
    }),
  ) as Permissions
}

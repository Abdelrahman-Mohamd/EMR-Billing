import { useSyncExternalStore } from 'react'
import { permissionsFrom, withLevel, type AccessLevel, type ModuleKey } from '../model/permissions'
import { roleCodeFrom, type Role } from '../model/role'

/**
 * WHERE ROLES LIVE FOR NOW — a temporary, in-memory store in this browser tab.
 * **There is no backend for roles or permissions**, so nothing here calls a
 * server, and nothing pretends to: no endpoint, payload or request. This is
 * architecture only; the screen shows no message about it.
 *
 * - Changes last until the page reloads.
 * - In development and tests it starts with the prototype's roles
 *   (`sample-roles.ts`, loaded only when `__MOCK_DATA__` is true, so a
 *   production build never contains them); otherwise it starts empty.
 * - The screens only use `useRoles()`. When a backend exists, that hook is
 *   replaced by server-state hooks (docs/FRONTEND_ARCHITECTURE.md §5) and this
 *   file is deleted — the screens do not change.
 * - Nothing here enforces anything: what a role may do is the server's to
 *   decide on every request (docs/SECURITY.md §1; ADR 0007).
 *
 * Same pattern as the procedure codes and fee schedules stores.
 */
interface Snapshot {
  /** False only while the development sample is still loading. */
  ready: boolean
  roles: readonly Role[]
}

let snapshot: Snapshot = { ready: !__MOCK_DATA__, roles: [] }
const listeners = new Set<() => void>()

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

// Tested here, not through a helper: see src/lib/api/mock-data.d.ts.
if (__MOCK_DATA__) {
  void import('./sample-roles').then(({ SAMPLE_ROLES }) => {
    // Something may have been added while the sample loaded; keep it.
    if (!snapshot.ready) publish({ ready: true, roles: [...SAMPLE_ROLES, ...snapshot.roles] })
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function change(roleId: string, update: (role: Role) => Role): void {
  publish({ ...snapshot, roles: snapshot.roles.map((role) => (role.id === roleId ? update(role) : role)) })
}

export interface RolesSource extends Snapshot {
  /** Sets a module to Edit, View or Hidden. */
  setLevel: (roleId: string, module: ModuleKey, level: AccessLevel) => void
  /** Ticks or clears Delete on a module. */
  setDelete: (roleId: string, module: ModuleKey, allowed: boolean) => void
  /** A new custom role, copying another's permissions, as the prototype makes it. Returns its id. */
  create: (name: string, fromRoleId: string) => string
  remove: (roleId: string) => void
}

export function useRoles(): RolesSource {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ...current,
    setLevel: (roleId, module, level) =>
      change(roleId, (role) => ({
        ...role,
        permissions: { ...role.permissions, [module]: withLevel(role.permissions[module], level) },
      })),
    setDelete: (roleId, module, allowed) =>
      change(roleId, (role) => ({
        ...role,
        permissions: { ...role.permissions, [module]: { ...role.permissions[module], d: allowed } },
      })),
    create: (name, fromRoleId) => {
      const source = snapshot.roles.find((role) => role.id === fromRoleId)
      const code = roleCodeFrom(name)
      // A local identity only, unique in this list (a name of symbols alone has no code).
      const base = code === '' ? 'ROLE' : code
      let id = base
      for (let n = 2; snapshot.roles.some((role) => role.id === id); n += 1) id = `${base}_${n}`
      const role: Role = {
        id,
        code,
        name: name.trim(),
        description: source === undefined ? '' : `Custom role based on ${source.name}.`,
        kind: 'custom',
        isGlobal: false,
        permissions: source === undefined ? permissionsFrom({}) : structuredClone(source.permissions),
        userCount: 0,
      }
      publish({ ...snapshot, roles: [...snapshot.roles, role] })
      return id
    },
    remove: (roleId) => publish({ ...snapshot, roles: snapshot.roles.filter((role) => role.id !== roleId) }),
  }
}

/** Tests only: start from a known list. */
export function resetRoles(roles: readonly Role[]): void {
  publish({ ready: true, roles: structuredClone([...roles]) })
}

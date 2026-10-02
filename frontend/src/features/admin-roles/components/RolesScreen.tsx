import { useId, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Lock, Plus, ShieldCheck } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { InfoTip } from '@/components/ui/InfoTip'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { cn } from '@/lib/utils/cn'
import { useRoles } from '../data/role-store'
import { ACCESS_LEVELS, MODULES, accessLevelLabel, levelOf } from '../model/permissions'
import { ROLE_KIND_LABEL, type Role } from '../model/role'
import { NewRoleDialog } from './NewRoleDialog'
import { PermissionMatrix } from './PermissionMatrix'

/** The prototype opens on Practice Admin. */
const DEFAULT_ROLE_CODE = 'PRACTICE_ADMIN'

const users = (count: number) => `${count} ${count === 1 ? 'user' : 'users'}`

/** The list's groups, in this order: the kind is said once, by the group. */
const GROUPS: ReadonlyArray<{ kind: Role['kind']; label: string }> = [
  { kind: 'system', label: 'System roles' },
  { kind: 'standard', label: 'Standard roles' },
  { kind: 'custom', label: 'Custom roles' },
]

/**
 * Admin → Roles & permissions, as the prototype has it: the roles on one side
 * (name, kind, how many users hold it), the chosen role's permissions on the
 * other — an access level per module, the Delete tick, the flags — and
 * "New role". System roles are shown locked; a custom or standard role with no
 * users can be deleted. A change applies as soon as it is made, as in the
 * prototype. No search or filter: the prototype has none.
 *
 * **Frontend only.** There is no backend for roles or permissions: they live
 * in this browser tab (`data/role-store.ts`). That is architecture, not
 * product: the screen shows no message about it.
 *
 * Laid out to read top-down without boxes: the roles grouped by kind (the
 * list stays in view beside the permissions from 1280px); the chosen role's
 * name, kind, users and description; for a system role, that it is locked —
 * before its controls, not after; a one-line summary of its access with the
 * prototype's "Access levels" explanation behind an info icon; and the table.
 * (The prototype's "Limits beyond the flags" list for Practice Admin is left
 * out, at the user's request.)
 *
 * The chosen role is kept in the URL (`?role=<id>`, a local id). With none
 * chosen, Practice Admin is shown, as in the prototype.
 *
 * Not built: the prototype offers changes and Delete role only to a user whose
 * own role allows them; there is no permission model here yet
 * (docs/FRONTEND_ARCHITECTURE.md §8). And this screen does not decide what
 * anyone may do — the server does, on every request (docs/SECURITY.md §1).
 */
export function RolesScreen({ roleFilter }: { roleFilter: string | undefined }) {
  const navigate = useNavigate()
  const store = useRoles()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Role | null>(null)
  const headingId = useId()

  const { roles } = store
  const role =
    roles.find((item) => item.id === roleFilter) ??
    roles.find((item) => item.code === DEFAULT_ROLE_CODE) ??
    roles[0]
  const locked = role?.kind === 'system'
  // A new role copies one that is not global; with none, there is nothing to start from.
  const canCreate = roles.some((item) => !item.isGlobal)

  const select = (id: string | undefined) =>
    void navigate({ to: '/admin/roles', search: id === undefined ? {} : { role: id }, replace: true })

  const askToDelete = (target: Role) => {
    if (target.userCount > 0) {
      toast.warning('This role is assigned to users', 'Remove it from every user first.')
      return
    }
    setDeleting(target)
  }

  const newButton = canCreate ? (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
      New role
    </Button>
  ) : undefined

  return (
    <PageContainer>
      <PageHeader
        title="Roles & permissions"
        description="Permissions per role and module. A user with several roles gets the union."
        actions={newButton}
      />

      {!store.ready ? (
        <div className="grid gap-8 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-12" aria-busy="true">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      ) : role === undefined ? (
        <EmptyState
          icon={<ShieldCheck size={20} />}
          title="No roles yet"
          description="A role sets what its users can see and change, module by module."
        />
      ) : (
        <div className="grid items-start gap-8 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-12">
          {/* Stays in view beside a long table on a wide screen. */}
          <nav aria-label="Roles" className="grid gap-5 xl:sticky xl:top-6">
            {GROUPS.map((group) => {
              const members = roles.filter((item) => item.kind === group.kind)
              if (members.length === 0) return null
              return (
                <div key={group.kind}>
                  <h2 className="text-eyebrow text-n500 mb-1.5 px-3 font-medium uppercase">{group.label}</h2>
                  <ul className="grid grid-cols-2 gap-1 md:grid-cols-3 xl:grid-cols-1">
                    {members.map((item) => {
                      const current = item.id === role.id
                      return (
                        <li key={item.id}>
                          <Link
                            to="/admin/roles"
                            search={{ role: item.id }}
                            replace
                            aria-current={current ? 'true' : undefined}
                            className={cn(
                              'block rounded-md px-3 py-2 no-underline transition-colors duration-100',
                              current
                                ? 'bg-brand-wash shadow-[inset_0_0_0_1px_var(--color-brand-line)]'
                                : 'hover:bg-n50',
                            )}
                          >
                            <span
                              className={cn(
                                'text-meta flex items-center gap-1.5 font-medium break-words',
                                current ? 'text-brand-deep' : 'text-ink',
                              )}
                            >
                              <span className="min-w-0">{item.name}</span>
                              {item.kind === 'system' && (
                                <Lock size={13} aria-hidden="true" className="text-n400 flex-none" />
                              )}
                            </span>
                            <span className="text-micro text-n500 block">{users(item.userCount)}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </nav>

          <section aria-labelledby={headingId} className="min-w-0">
            <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <div className="min-w-0 grow basis-72">
                <h2 id={headingId} className="text-section text-ink leading-tight font-medium break-words">
                  {role.name}
                </h2>
                <p className="text-meta text-n500 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Tag tone={role.kind === 'system' ? 'brand' : 'inert'}>{ROLE_KIND_LABEL[role.kind]}</Tag>
                  <span>{users(role.userCount)}</span>
                  {role.isGlobal && <span>Global: sees every practice</span>}
                </p>
                {role.description !== '' && (
                  <p className="text-meta text-n600 mt-2 max-w-prose leading-snug">{role.description}</p>
                )}
              </div>
              {!locked && (
                <Button variant="danger" size="sm" onClick={() => askToDelete(role)}>
                  Delete role
                </Button>
              )}
            </header>

            {/* Said before the controls it disables, not after them. */}
            {locked && (
              <p className="text-micro text-n500 mt-4 flex items-start gap-1.5">
                <Lock size={14} aria-hidden="true" className="mt-px flex-none" />
                System roles cannot be changed. Create a custom role to adjust permissions.
              </p>
            )}

            <div className="text-micro text-n500 mt-8 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Across {MODULES.length} modules:</span>
              {ACCESS_LEVELS.map((level) => (
                <span key={level.value}>
                  {level.label}{' '}
                  <span className="text-ink font-medium tabular-nums">
                    {MODULES.filter((module) => levelOf(role.permissions[module.key]) === level.value).length}
                  </span>
                </span>
              ))}
              <InfoTip label="About access levels">
                Edit lets the role create, view and update records in the module — and delete them when Delete
                is ticked. View is read-only. Hidden removes the section.
              </InfoTip>
            </div>

            <div className="mt-1">
              <PermissionMatrix
                // A new matrix per role: the radio groups' names are per module.
                key={role.id}
                role={role}
                locked={locked}
                onLevelChange={(module, level) => {
                  store.setLevel(role.id, module, level)
                  const label = MODULES.find((item) => item.key === module)?.label ?? module
                  toast.success(
                    `${role.name}: ${label} set to ${accessLevelLabel(level)}`,
                    'Applies immediately to every user holding this role.',
                  )
                }}
                onDeleteChange={(module, allowed) => store.setDelete(role.id, module, allowed)}
              />
            </div>
          </section>
        </div>
      )}

      {creating && (
        <NewRoleDialog
          roles={roles}
          onCreate={(name, fromRoleId) => select(store.create(name, fromRoleId))}
          onClose={() => setCreating(false)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="The role and its permissions are removed."
        confirmLabel="Delete role"
        tone="destructive"
        onConfirm={() => {
          if (deleting !== null) store.remove(deleting.id)
          setDeleting(null)
          select(undefined)
        }}
      />
    </PageContainer>
  )
}

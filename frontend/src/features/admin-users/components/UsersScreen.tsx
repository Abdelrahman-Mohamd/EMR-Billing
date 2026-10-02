import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useUsers } from '../queries/use-users'
import type { User } from '../schemas/user'
import { UserDialog } from './UserDialog'
import { UserStatusDialog } from './UserStatusDialog'

/** What is open over the list. One at a time. */
type Open = { kind: 'form'; user: User | null } | { kind: 'status'; user: User }

/**
 * Admin → Users: who can sign in, as the prototype lists them — name and
 * email, and the shared Active switch and Edit action
 * (components/ui/RowActions); the switch deactivates or reactivates the user
 * after a confirmation, as the prototype's row action does. No password is in
 * the list data at all.
 *
 * Not shown, because the payload has none of it: roles, practice and location
 * grants, username, service-account flag. Not built: delete (the prototype has
 * none), hiding the actions on one's own row (there is no current-user
 * information yet), and search (the prototype has none).
 *
 * The list is not paged: no API defines paging. It is sorted here, by name, as
 * the prototype sorts it.
 */
export function UsersScreen() {
  const users = useUsers()
  const [open, setOpen] = useState<Open | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 'asc' })

  const rows = [...(users.data ?? [])].sort((a, b) => {
    const order = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    return sort.direction === 'asc' ? order : -order
  })

  const columns: ReadonlyArray<Column<User>> = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      cell: (user) => (
        <span className="block [overflow-wrap:anywhere]">
          {user.name}
          {/* On a phone the email column is hidden; the address rides here. */}
          <span className="sm:hidden">
            <CellSub>{user.email}</CellSub>
          </span>
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      hideOnMobile: true,
      cell: (user) => <span className="[overflow-wrap:anywhere]">{user.email}</span>,
    },
    activeColumn<User>({
      isActive: (user) => user.isActive,
      label: (user) => user.name,
      // As in the prototype, a change of status asks first (UserStatusDialog).
      onChange: (user) => setOpen({ kind: 'status', user }),
    }),
    actionsColumn<User>((user) => (
      <RowActionButton
        action="edit"
        label={`Edit ${user.name}`}
        onClick={() => setOpen({ kind: 'form', user })}
      />
    )),
  ]

  const newUser = (label: string) => (
    <Button
      variant="primary"
      icon={<Plus size={16} aria-hidden="true" />}
      onClick={() => setOpen({ kind: 'form', user: null })}
    >
      {label}
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Create and manage the people who can sign in to billing."
        actions={newUser('New user')}
      />

      <DataTable
        caption="Users"
        columns={columns}
        rows={rows}
        getRowId={(user) => String(user.id)}
        loading={users.isPending}
        error={users.isError}
        onRetry={() => void users.refetch()}
        sort={sort}
        onSortChange={setSort}
        empty={
          <EmptyState
            icon={<Users size={20} />}
            title="No users yet"
            description="Create the first person who can sign in to billing."
            action={newUser('New user')}
          />
        }
        footer={<span>{rows.length === 1 ? '1 user' : `${rows.length} users`}</span>}
      />

      {open?.kind === 'form' && (
        <UserDialog key={open.user?.id ?? 'new'} user={open.user} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'status' && (
        <UserStatusDialog key={open.user.id} user={open.user} onClose={() => setOpen(null)} />
      )}
    </PageContainer>
  )
}

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Pagination } from '@/components/ui/Pagination'
import { RowActionButton, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useCurrentUser } from '@/features/auth'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { useDeleteUser, useUsersPage } from '../queries/use-users'
import type { User } from '../schemas/user'
import { UserDialog } from './UserDialog'
import { UserStatusDialog } from './UserStatusDialog'

/** What is open over the list. One at a time. */
type Open =
  { kind: 'form'; user: User | null } | { kind: 'status'; user: User } | { kind: 'delete'; user: User }

/**
 * Admin → Users: who can sign in, as the prototype lists them — name and
 * email, and the shared Active switch, Edit and Delete actions
 * (components/ui/RowActions). The switch deactivates or reactivates the user
 * after a confirmation, as the prototype's row action does; Delete asks first
 * too. No password is in the list data at all.
 *
 * The list is the server's: 15 a page, in the server's order, with a pager —
 * no sort or search parameter is part of the contract, so the name column
 * does not sort (sorting one page would misstate the whole list).
 *
 * The signed-in user's own row offers no Delete (`GET /auth/me` says who that
 * is). The server decides what anyone may do regardless.
 *
 * Not shown, because the backend has none of it: roles, practice and location
 * grants, username, service-account flag.
 */
export function UsersScreen() {
  const [page, setPage] = useState(1)
  const users = useUsersPage(page)
  const me = useCurrentUser()
  const remove = useDeleteUser()
  const [open, setOpen] = useState<Open | null>(null)

  const rows = users.data?.users ?? []
  const total = users.data?.total ?? 0
  const pageCount = users.data?.pageCount ?? 1

  const confirmDelete = async (user: User) => {
    try {
      const message = await remove.mutateAsync(user.id)
      toast.success(message ?? `${user.name} deleted`)
      // The last row of the last page: step back rather than show an empty page.
      if (rows.length === 1 && page > 1) setPage(page - 1)
    } catch (error) {
      toast.error(
        `${user.name} was not deleted`,
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }

  const columns: ReadonlyArray<Column<User>> = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      cell: (user) => <span className="block break-words">{user.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (user) => <span className="break-words">{user.email}</span>,
    },
    activeColumn<User>({
      isActive: (user) => user.isActive,
      label: (user) => user.name,
      // As in the prototype, a change of status asks first (UserStatusDialog).
      onChange: (user) => setOpen({ kind: 'status', user }),
      // Not oneself: the server takes it, signs the user out and locks them out
      // at once, with no way back (user, 2026-10-19).
      disabled: (user) => user.id === me.data?.id,
    }),
    actionsColumn<User>((user) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit ${user.name}`}
          onClick={() => setOpen({ kind: 'form', user })}
        />
        {user.id !== me.data?.id && (
          <RowActionButton
            action="delete"
            label={`Delete ${user.name}`}
            onClick={() => setOpen({ kind: 'delete', user })}
          />
        )}
      </>
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

  const summary =
    pageCount <= 1
      ? total === 1
        ? '1 user'
        : `${total} users`
      : `Showing ${users.data?.from ?? 0}–${users.data?.to ?? 0} of ${total} users`

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
        empty={
          <EmptyState
            icon={<Users size={20} />}
            title="No users yet"
            description="Create the first person who can sign in to billing."
            action={newUser('New user')}
          />
        }
        footer={
          total > 0 ? (
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />

      {open?.kind === 'form' && (
        <UserDialog key={open.user?.id ?? 'new'} user={open.user} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'status' && (
        <UserStatusDialog key={open.user.id} user={open.user} onClose={() => setOpen(null)} />
      )}
      <ConfirmDialog
        open={open?.kind === 'delete'}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpen(null)
        }}
        title={`Delete ${open?.kind === 'delete' ? open.user.name : ''}?`}
        description="They can no longer sign in."
        confirmLabel="Delete user"
        tone="destructive"
        onConfirm={() => (open?.kind === 'delete' ? confirmDelete(open.user) : undefined)}
      />
    </PageContainer>
  )
}

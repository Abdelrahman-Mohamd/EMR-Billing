import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, deleteUser, getUser, listUsers, setUserActive, updateUser } from '../api/users-api'
import type { NewUserFormValues, User, UserFormValues, UserPage } from '../schemas/user'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const userKeys = {
  all: ['users'] as const,
  page: (page: number) => [...userKeys.all, 'page', page] as const,
  detail: (id: number) => [...userKeys.all, 'detail', id] as const,
}

/** One page of users, as the server pages them. The previous page stays on screen while the next loads. */
export function useUsersPage(page: number) {
  return useQuery({
    queryKey: userKeys.page(page),
    queryFn: ({ signal }) => listUsers(page, signal),
    placeholderData: keepPreviousData,
  })
}

/** One user as they are now, for the edit form; `null` asks for nothing (a new one). */
export function useUser(id: number | null) {
  return useQuery({
    queryKey: userKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getUser(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

/**
 * Creating or saving a user can send a password, so neither goes through
 * `useMutation`: TanStack Query would keep the variables — the password — in
 * its mutation cache and show them in devtools (the same rule as sign-in,
 * docs/SECURITY.md §2). The caller tracks the pending state with its form;
 * these only send, then refresh the lists, and resolve with the server's
 * message.
 */
export function useCreateUser(): (values: NewUserFormValues) => Promise<string | null> {
  const queryClient = useQueryClient()
  return async (values) => {
    const message = await createUser(values)
    void queryClient.invalidateQueries({ queryKey: userKeys.all })
    return message
  }
}

export function useUpdateUser(): (id: number, values: UserFormValues) => Promise<string | null> {
  const queryClient = useQueryClient()
  return async (id, values) => {
    const message = await updateUser(id, values)
    void queryClient.invalidateQueries({ queryKey: userKeys.all })
    return message
  }
}

/**
 * The row's Active switch, once confirmed. When the server has saved it, the
 * new status is written into the cached pages at once — the switch shows it
 * as the dialog closes — and the lists are read again in the background.
 */
export function useSetUserActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ user, isActive }: { user: User; isActive: boolean }) => setUserActive(user, isActive),
    onSuccess: (_message, { user, isActive }) => {
      queryClient.setQueriesData<UserPage>({ queryKey: [...userKeys.all, 'page'] }, (page) =>
        page === undefined
          ? page
          : {
              ...page,
              users: page.users.map((item) => (item.id === user.id ? { ...item, isActive } : item)),
            },
      )
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

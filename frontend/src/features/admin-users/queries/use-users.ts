import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, listUsers, updateUser } from '../api/users-api'
import type { NewUserFormValues, User, UserFormValues } from '../schemas/user'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
}

export function useUsers() {
  return useQuery({ queryKey: userKeys.list(), queryFn: ({ signal }) => listUsers(signal) })
}

/**
 * Creating a user sends a password, so it deliberately does **not** go
 * through `useMutation`: TanStack Query would keep the variables — the
 * password — in its mutation cache and show them in devtools (the same rule
 * as sign-in, docs/SECURITY.md §2). The caller tracks the pending state with
 * its form; this only sends and then refreshes the list.
 */
export function useCreateUser(): (values: NewUserFormValues) => Promise<User> {
  const queryClient = useQueryClient()
  return async (values) => {
    const created = await createUser(values)
    await queryClient.invalidateQueries({ queryKey: userKeys.all })
    return created
  }
}

/** Saving a user carries no password, so it is an ordinary mutation. */
export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: UserFormValues }) => updateUser(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createOrganization, listOrganizations, updateOrganization } from '../api/organizations-api'
import type { OrganizationFormValues } from '../schemas/organization'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const organizationKeys = {
  all: ['organizations'] as const,
  list: () => [...organizationKeys.all, 'list'] as const,
}

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: ({ signal }) => listOrganizations(signal),
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OrganizationFormValues) => createOrganization(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.list() }),
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: OrganizationFormValues }) =>
      updateOrganization(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.list() }),
  })
}

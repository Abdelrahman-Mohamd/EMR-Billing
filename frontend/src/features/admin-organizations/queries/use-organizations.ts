import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listAllOrganizations,
  listOrganizations,
  updateOrganization,
} from '../api/organizations-api'
import type {
  Organization,
  OrganizationDetail,
  OrganizationFormValues,
  OrganizationPage,
} from '../schemas/organization'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const organizationKeys = {
  all: ['organizations'] as const,
  page: (page: number) => [...organizationKeys.all, 'page', page] as const,
  everything: () => [...organizationKeys.all, 'all'] as const,
  detail: (id: number) => [...organizationKeys.all, 'detail', id] as const,
}

/** One page of the list, as the server pages it. The previous page stays on screen while the next loads. */
export function useOrganizationsPage(page: number) {
  return useQuery({
    queryKey: organizationKeys.page(page),
    queryFn: ({ signal }) => listOrganizations(page, signal),
    placeholderData: keepPreviousData,
  })
}

/** Every organization — for other features' pickers and name lookups (a practice's organization). */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.everything(),
    queryFn: ({ signal }) => listAllOrganizations(signal),
  })
}

/** One organization as it is now, for the edit form; `null` asks for nothing (a new one). */
export function useOrganization(id: number | null) {
  return useQuery({
    queryKey: organizationKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getOrganization(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

/** After any change, every list, page and record of this domain is read again. */
function useInvalidateOrganizations() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: organizationKeys.all })
}

export function useCreateOrganization() {
  const invalidate = useInvalidateOrganizations()
  return useMutation({
    mutationFn: (input: OrganizationFormValues) => createOrganization(input),
    onSuccess: invalidate,
  })
}

export function useUpdateOrganization() {
  const invalidate = useInvalidateOrganizations()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: OrganizationFormValues }) =>
      updateOrganization(id, input),
    onSuccess: invalidate,
  })
}

/**
 * The row's Active switch, once confirmed: the organization's own update, with
 * only `is_active` changed. The confirmation stays open until the server has
 * saved it; then the new status is written into every cached list and record
 * at once — the switch shows it as the dialog closes, without waiting for the
 * lists to be read again (they are, in the background). Nothing is shown
 * before the server has said yes.
 */
export function useSetOrganizationActive() {
  const queryClient = useQueryClient()
  const show = (id: number, isActive: boolean) => {
    const set = (organization: Organization) =>
      organization.id === id ? { ...organization, isActive } : organization
    queryClient.setQueriesData<OrganizationPage>({ queryKey: [...organizationKeys.all, 'page'] }, (page) =>
      page === undefined ? page : { ...page, organizations: page.organizations.map(set) },
    )
    queryClient.setQueriesData<Organization[]>({ queryKey: organizationKeys.everything() }, (all) =>
      all?.map(set),
    )
    queryClient.setQueriesData<OrganizationDetail>({ queryKey: organizationKeys.detail(id) }, (detail) =>
      detail === undefined ? detail : { ...detail, isActive },
    )
  }
  return useMutation({
    mutationFn: ({ organization, isActive }: { organization: Organization; isActive: boolean }) =>
      updateOrganization(organization.id, { name: organization.name, isActive }),
    onSuccess: (_message, { organization, isActive }) => {
      show(organization.id, isActive)
      // Not awaited: the dialog closes on the save, not on the re-read.
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all })
    },
  })
}

export function useDeleteOrganization() {
  const invalidate = useInvalidateOrganizations()
  return useMutation({
    mutationFn: (id: number) => deleteOrganization(id),
    onSuccess: invalidate,
  })
}

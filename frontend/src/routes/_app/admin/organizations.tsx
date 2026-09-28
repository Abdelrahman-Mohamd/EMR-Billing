import { createFileRoute } from '@tanstack/react-router'
import { OrganizationsScreen } from '@/features/admin-organizations'

export const Route = createFileRoute('/_app/admin/organizations')({
  component: OrganizationsScreen,
})

import { createFileRoute } from '@tanstack/react-router'
import { UsersScreen } from '@/features/admin-users'

export const Route = createFileRoute('/_app/admin/users')({
  component: UsersScreen,
})

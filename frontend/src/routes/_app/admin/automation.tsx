import { createFileRoute } from '@tanstack/react-router'
import { AutomationScreen } from '@/features/admin-automation'

export const Route = createFileRoute('/_app/admin/automation')({
  component: AutomationScreen,
})

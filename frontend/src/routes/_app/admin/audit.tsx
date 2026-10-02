import { createFileRoute } from '@tanstack/react-router'
import { AuditLogScreen } from '@/features/admin-audit-log'

export const Route = createFileRoute('/_app/admin/audit')({
  component: AuditLogScreen,
})

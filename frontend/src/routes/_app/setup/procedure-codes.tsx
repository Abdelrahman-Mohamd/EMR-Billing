import { createFileRoute } from '@tanstack/react-router'
import { ProcedureCodesScreen } from '@/features/admin-procedure-codes'

export const Route = createFileRoute('/_app/setup/procedure-codes')({
  component: ProcedureCodesScreen,
})

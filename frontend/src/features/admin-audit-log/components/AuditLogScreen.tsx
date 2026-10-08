import { useState } from 'react'
import { History } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { formatWhen } from '@/lib/utils/format-when'
import { moduleLabel } from '../model/modules'
import { useAuditLog } from '../queries/use-audit-log'
import type { AuditEntry } from '../schemas/audit-entry'
import { AuditEntryDrawer } from './AuditEntryDrawer'

/**
 * Admin → Audit log: a read-only table of When, User, Action (with its detail)
 * and Module, newest first, a page at a time as the server pages it (15), with
 * "Showing 1–15 of N entries" and a pager. A row opens the entry in full in a
 * side panel (`GET /activity-logs/{id}`), so the page and place in the list
 * stay where they were.
 *
 * Not built, because the endpoints have no contract for them: the prototype's
 * search and module filter (filtering only the loaded page would say "nothing
 * matches" while other pages match), and its "Open" link to the affected
 * record. Nothing on an entry can be changed.
 */
export function AuditLogScreen() {
  const [page, setPage] = useState(1)
  const [opened, setOpened] = useState<AuditEntry | null>(null)
  const log = useAuditLog({ page })
  const total = log.data?.total ?? 0

  const columns: ReadonlyArray<Column<AuditEntry>> = [
    {
      key: 'at',
      header: 'When',
      cell: (entry) => {
        const when = formatWhen(entry.at)
        return (
          <span className="block whitespace-nowrap">
            {when.label}
            {when.date !== '' && <CellSub>{when.date}</CellSub>}
          </span>
        )
      },
    },
    {
      key: 'user',
      header: 'User',
      cell: (entry) => <UserName entry={entry} />,
    },
    {
      key: 'action',
      header: 'Action',
      primary: true,
      cell: (entry) => (
        <span className="block break-words">
          {entry.action}
          {entry.detail !== '' && <CellSub>{entry.detail}</CellSub>}
        </span>
      ),
    },
    {
      key: 'module',
      header: 'Module',
      cell: (entry) =>
        entry.module === '' ? null : <Tag className="whitespace-nowrap">{moduleLabel(entry.module)}</Tag>,
    },
  ]

  const pageCount = log.data?.pageCount ?? 1
  const summary =
    pageCount <= 1
      ? `${total} ${total === 1 ? 'entry' : 'entries'}`
      : `Showing ${log.data?.from ?? 0}–${log.data?.to ?? 0} of ${total} entries`

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Review every action taken in the system: who did what, and when."
      />

      <DataTable
        caption="Audit log"
        columns={columns}
        rows={log.data?.entries ?? []}
        getRowId={(entry) => entry.id}
        rowAction={{
          label: (entry) => `${entry.action}, ${formatWhen(entry.at).label}: view details`,
          onAction: setOpened,
        }}
        loading={log.isPending}
        error={log.isError}
        onRetry={() => void log.refetch()}
        empty={
          <EmptyState
            icon={<History size={20} />}
            title="No audit entries yet"
            description="Actions taken in the system are recorded here as they happen."
          />
        }
        footer={
          total > 0 ? (
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />
      {opened !== null && <AuditEntryDrawer entry={opened} onClose={() => setOpened(null)} />}
    </PageContainer>
  )
}

/** Who did it; a failed sign-in has no signed-in user. */
function UserName({ entry }: { entry: AuditEntry }) {
  return entry.userName === '' ? (
    <span className="text-n500">No user</span>
  ) : (
    <span className="break-words">{entry.userName}</span>
  )
}

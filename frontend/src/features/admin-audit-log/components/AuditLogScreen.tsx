import { useState } from 'react'
import { History } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { formatWhen } from '@/lib/utils/format-when'
import { MODULES, moduleLabel } from '../model/modules'
import { useAuditLog } from '../queries/use-audit-log'
import type { AuditEntry } from '../schemas/audit-entry'
import { AuditEntryDrawer } from './AuditEntryDrawer'

/**
 * Admin → Audit log: a read-only table of When, User, Action (with its detail)
 * and Module, newest first, a page at a time as the server pages it (15), with
 * "Showing 1–15 of N entries" and a pager. A row opens the entry in full in a
 * side panel (`GET /activity-logs/{id}`), so the page and place in the list
 * stay where they were. The prototype's module filter is the server's: one
 * module at a time (`log_name` takes one), in the filter bar; changing it goes
 * back to page 1.
 *
 * Not built, because the server has nothing for them: the prototype's search
 * (filtering only the loaded page would say "nothing matches" while other
 * pages match), and its "Open" link to the affected record. Nothing on an
 * entry can be changed.
 */
export function AuditLogScreen() {
  const [page, setPage] = useState(1)
  const [module, setModule] = useState<string | null>(null)
  const [opened, setOpened] = useState<AuditEntry | null>(null)
  const log = useAuditLog({ page, ...(module === null ? {} : { module }) })
  const chooseModule = (next: string | null) => {
    setModule(next)
    setPage(1)
  }
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

      <FilterBar {...(module === null ? {} : { onReset: () => chooseModule(null) })}>
        <Select
          aria-label="Filter by module"
          value={module}
          onChange={chooseModule}
          options={MODULES.map((value) => ({ value, label: moduleLabel(value) }))}
          placeholder="All modules"
          clearable
          className="w-full sm:w-64"
        />
      </FilterBar>

      <DataTable
        caption="Audit log"
        columns={columns}
        rows={log.data?.entries ?? []}
        getRowId={(entry) => entry.id}
        rowAction={{
          label: (entry) => `${entry.action}, ${formatWhen(entry.at).label}: view details`,
          onAction: setOpened,
        }}
        // A row opens the entry in a side panel; "View details" at its end says so, as on Patients.
        openHint="View details"
        loading={log.isPending}
        error={log.isError}
        onRetry={() => void log.refetch()}
        empty={
          module === null ? (
            <EmptyState
              icon={<History size={20} />}
              title="No audit entries yet"
              description="Actions taken in the system are recorded here as they happen."
            />
          ) : (
            <EmptyState
              icon={<History size={20} />}
              title={`No ${moduleLabel(module).toLowerCase()} entries`}
              description="Nothing has been recorded for this module yet."
            />
          )
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

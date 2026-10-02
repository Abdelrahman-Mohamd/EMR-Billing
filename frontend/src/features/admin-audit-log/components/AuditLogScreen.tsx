import { useRef, useState } from 'react'
import { History } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { FilterPills } from '@/components/ui/FilterPills'
import { SearchInput } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { formatWhen } from '@/lib/utils/format-when'
import { AUDIT_MODULES, moduleLabel } from '../model/modules'
import { useAuditLog } from '../queries/use-audit-log'
import type { AuditEntry } from '../schemas/audit-entry'

/** The prototype pages the log 20 entries at a time. */
export const AUDIT_PAGE_SIZE = 20
/** The prototype waits this long after typing before it searches. */
const SEARCH_DELAY_MS = 220

/**
 * Admin → Audit log, as the prototype has it: a search over action, detail
 * and user; module pills (any number on, none = every module); a read-only
 * table of When, User, Action (with its detail) and Module, newest first; 20
 * entries a page with "Showing 1–20 of N entries" and a pager.
 *
 * Not built: the prototype's "Open" link to the affected record — the claim,
 * visit, denial and exception screens it opens do not exist here yet. There
 * is no detail view and no action on an entry; the prototype has neither.
 *
 * The search text stays in the screen, not the URL: it can hold a patient's
 * name, and PHI never goes in a URL.
 */
export function AuditLogScreen() {
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const log = useAuditLog({ search, modules, page, pageSize: AUDIT_PAGE_SIZE })
  const total = log.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE))
  const filtered = search !== '' || modules.length > 0

  const onSearchChange = (value: string) => {
    setSearchText(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(value.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
  }
  const onModulesChange = (next: string[]) => {
    setModules(next)
    setPage(1)
  }
  const clearAll = () => {
    clearTimeout(searchTimer.current)
    setSearchText('')
    setSearch('')
    setModules([])
    setPage(1)
  }

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
      hideOnMobile: true,
      cell: (entry) => <span className="[overflow-wrap:anywhere]">{entry.userName}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      primary: true,
      cell: (entry) => (
        <span className="block [overflow-wrap:anywhere]">
          {entry.action}
          {entry.detail !== '' && <CellSub>{entry.detail}</CellSub>}
          {/* On a phone, where their columns are hidden, the user and module ride under the action. */}
          <span className="sm:hidden">
            <CellSub>
              {entry.userName}
              {entry.module !== '' && (
                <>
                  <span aria-hidden="true"> · </span>
                  {moduleLabel(entry.module)}
                </>
              )}
            </CellSub>
          </span>
        </span>
      ),
    },
    {
      key: 'module',
      header: 'Module',
      hideOnMobile: true,
      cell: (entry) =>
        entry.module === '' ? null : <Tag className="whitespace-nowrap">{moduleLabel(entry.module)}</Tag>,
    },
  ]

  const first = (page - 1) * AUDIT_PAGE_SIZE + 1
  const last = Math.min(page * AUDIT_PAGE_SIZE, total)
  const summary =
    total <= AUDIT_PAGE_SIZE
      ? `${total} ${total === 1 ? 'entry' : 'entries'}`
      : `Showing ${first}–${last} of ${total} entries`

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Review every action taken in the system: who did what, and when."
      />

      <FilterBar
        search={
          <SearchInput
            aria-label="Search action, detail or user"
            placeholder="Search action, detail or user…"
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            autoComplete="off"
          />
        }
        {...(filtered ? { onReset: clearAll } : {})}
      />
      <FilterPills
        label="Filter by module"
        options={AUDIT_MODULES}
        selected={modules}
        onChange={onModulesChange}
        className="mb-3"
      />

      <DataTable
        caption="Audit log"
        columns={columns}
        rows={log.data?.entries ?? []}
        getRowId={(entry) => entry.id}
        loading={log.isPending}
        error={log.isError}
        onRetry={() => void log.refetch()}
        empty={
          filtered ? (
            <EmptyState
              icon={<History size={20} />}
              title="No entries match"
              description="Try a different search, or turn off a module filter."
              action={<Button onClick={clearAll}>Clear search and filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<History size={20} />}
              title="No audit entries yet"
              description="Actions taken in the system are recorded here as they happen."
            />
          )
        }
        footer={
          total > 0 ? (
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />
    </PageContainer>
  )
}

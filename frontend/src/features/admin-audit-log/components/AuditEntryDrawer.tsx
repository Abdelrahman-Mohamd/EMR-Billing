import { Tag } from '@/components/ui/Badge'
import { Section } from '@/components/ui/Card'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { KeyValue, type KeyValueItem } from '@/components/ui/KeyValue'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { isApiError } from '@/lib/api/api-error'
import { moduleLabel } from '../model/modules'
import { useAuditEntry } from '../queries/use-audit-log'
import type { AuditEntry, AuditEntryDetail } from '../schemas/audit-entry'

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * The exact moment, to the second, in the viewer's time zone: 10/07/2026
 * 15:16:52. An unreadable value is shown as it came.
 */
function exactTime(timestamp: string): string {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) return timestamp
  return `${pad(at.getMonth() + 1)}/${pad(at.getDate())}/${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
}

type Change = AuditEntryDetail['changes'][number]

const CHANGE_COLUMNS: ReadonlyArray<Column<Change>> = [
  { key: 'field', header: 'Field', primary: true, cell: (change) => change.label },
  {
    key: 'before',
    header: 'Before',
    cell: (change) => (
      <span className="[overflow-wrap:anywhere]">{change.before === '' ? '—' : change.before}</span>
    ),
  },
  {
    key: 'after',
    header: 'After',
    cell: (change) => (
      <span className="[overflow-wrap:anywhere]">{change.after === '' ? '—' : change.after}</span>
    ),
  },
]

/**
 * One audit entry in full, beside the list: `GET /activity-logs/{id}`. The
 * row's own action and time head the panel at once; the rest arrives with the
 * entry. Read-only, like the log.
 */
export function AuditEntryDrawer({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const detail = useAuditEntry(entry.id)

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={entry.action === '' ? 'Audit entry' : entry.action}
      description={exactTime(detail.data?.at ?? entry.at)}
    >
      {detail.isPending ? (
        <SkeletonRows rows={4} columns={2} />
      ) : detail.isError ? (
        isApiError(detail.error) && detail.error.kind === 'not_found' ? (
          <ErrorState title="This entry could not be found" description="It may no longer be in the log." />
        ) : (
          <ErrorState onRetry={() => void detail.refetch()} />
        )
      ) : (
        <EntryDetail entry={detail.data} />
      )}
    </Drawer>
  )
}

function EntryDetail({ entry }: { entry: AuditEntryDetail }) {
  const items: KeyValueItem[] = [
    {
      label: 'User',
      value:
        entry.user === null ? (
          'No user'
        ) : (
          <>
            {entry.user.name}
            {entry.user.email !== '' && <CellSub>{entry.user.email}</CellSub>}
          </>
        ),
    },
    { label: 'Module', value: entry.module === '' ? '' : <Tag>{moduleLabel(entry.module)}</Tag> },
    { label: 'Event', value: entry.event },
    { label: 'Record', value: entry.record },
    ...entry.properties.map((property) => ({ label: property.label, value: property.value })),
    ...(entry.batch === '' ? [] : [{ label: 'Batch', value: entry.batch, wide: true }]),
  ]

  return (
    <>
      <KeyValue items={items} className="pt-0" />
      {entry.changes.length > 0 && (
        <Section title="Changes" headingLevel={3} className="pb-0">
          <DataTable
            caption="Changes"
            columns={CHANGE_COLUMNS}
            rows={entry.changes}
            getRowId={(change) => change.field}
          />
        </Section>
      )}
    </>
  )
}

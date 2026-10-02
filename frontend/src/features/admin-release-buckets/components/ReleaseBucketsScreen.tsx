import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Inbox, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { useReleaseBuckets } from '../queries/use-release-buckets'
import type { ReleaseBucket } from '../schemas/release-bucket'
import { ReleaseBucketDialog } from './ReleaseBucketDialog'

/**
 * Setup → Release buckets: the list and the dialog that adds or edits one.
 * Laid out as the prototype's list — the bucket's name with its description
 * under it — plus the practice. The prototype's "held insurances", "claims
 * waiting" and status columns are left out: the payload has no status, and
 * the bucket's links to insurances and claims are not defined by the backend
 * yet.
 *
 * As for the other practice-scoped screens, every practice's buckets are
 * listed with a practice filter kept in the URL (`?practice=<id>`). Not paged
 * or searched: the prototype does neither. Sorted by name.
 */
export function ReleaseBucketsScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const buckets = useReleaseBuckets()
  const practices = usePractices()
  /** `undefined`: no dialog. `null`: adding. A bucket: editing it. */
  const [editing, setEditing] = useState<ReleaseBucket | null | undefined>(undefined)
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 'asc' })

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/release-buckets',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const rows = (buckets.data ?? [])
    .filter((bucket) => practiceFilter === undefined || bucket.practiceId === practiceFilter)
    .sort((a, b) => {
      const order = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      return sort.direction === 'asc' ? order : -order
    })

  const columns: ReadonlyArray<Column<ReleaseBucket>> = [
    {
      key: 'name',
      header: 'Bucket',
      primary: true,
      sortable: true,
      cell: (bucket) => (
        <span className="block max-w-prose [overflow-wrap:anywhere]">
          {bucket.name}
          {bucket.description !== '' && <CellSub>{bucket.description}</CellSub>}
          {/* On a phone, where its column is hidden, the practice rides under the bucket. */}
          {practiceName(bucket.practiceId) !== undefined && (
            <span className="sm:hidden">
              <CellSub>{practiceName(bucket.practiceId)}</CellSub>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'practice',
      header: 'Practice',
      hideOnMobile: true,
      cell: (bucket) => (
        <span className="[overflow-wrap:anywhere]">{practiceName(bucket.practiceId) ?? '—'}</span>
      ),
    },
    actionsColumn<ReleaseBucket>((bucket) => (
      <RowActionButton action="edit" label={`Edit ${bucket.name}`} onClick={() => setEditing(bucket)} />
    )),
  ]

  const newButton = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing(null)}>
      New release bucket
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Release buckets"
        description="Create and manage the release buckets of your practices."
        actions={newButton}
      />

      <FilterBar {...(filter === null ? {} : { onReset: () => setFilter(null) })}>
        <PracticeSelect
          aria-label="Filter by practice"
          value={filter}
          onChange={setFilter}
          placeholder="All practices"
          clearable
          className="w-full sm:w-64"
        />
      </FilterBar>

      <DataTable
        caption="Release buckets"
        columns={columns}
        rows={rows}
        getRowId={(bucket) => String(bucket.id)}
        loading={buckets.isPending}
        error={buckets.isError}
        onRetry={() => void buckets.refetch()}
        sort={sort}
        onSortChange={setSort}
        empty={
          filter === null ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="No release buckets yet"
              description="Add the first release bucket for one of your practices."
              action={
                <Button
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setEditing(null)}
                >
                  Add a release bucket
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Inbox size={20} />}
              title="No release buckets in this practice"
              description="Add one, or show every practice."
              action={<Button onClick={() => setFilter(null)}>Show all practices</Button>}
            />
          )
        }
        footer={<span>{rows.length === 1 ? '1 release bucket' : `${rows.length} release buckets`}</span>}
      />

      {editing !== undefined && (
        <ReleaseBucketDialog
          key={editing?.id ?? 'new'}
          bucket={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </PageContainer>
  )
}

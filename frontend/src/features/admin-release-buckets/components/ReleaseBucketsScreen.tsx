import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Inbox, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { RowActionButton, StatusChangeDialog, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import {
  useDeleteReleaseBucket,
  useReleaseBuckets,
  useSetReleaseBucketActive,
} from '../queries/use-release-buckets'
import type { ReleaseBucket } from '../schemas/release-bucket'
import { ReleaseBucketDialog } from './ReleaseBucketDialog'

/**
 * Setup → Release buckets: the list and the dialog that adds or edits one.
 * Laid out as the prototype's list — the bucket's name with its description
 * under it, the practice, how many insurances are assigned to it
 * (`insurances_count`), and the Active switch (asks first) — with Edit and
 * Delete. What the backend does not carry is left out: the prototype's names
 * of the held insurances (the list has only their count) and "Claims waiting".
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
  /** The row whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<ReleaseBucket | null>(null)
  const [deleting, setDeleting] = useState<ReleaseBucket | null>(null)
  const setActive = useSetReleaseBucketActive()
  const remove = useDeleteReleaseBucket()

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/release-buckets',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const rows = (buckets.data ?? []).filter(
    (bucket) => practiceFilter === undefined || bucket.practiceId === practiceFilter,
  )

  const columns: ReadonlyArray<Column<ReleaseBucket>> = [
    {
      key: 'name',
      header: 'Bucket',
      primary: true,
      cell: (bucket) => (
        <span className="block max-w-prose break-words">
          {bucket.name}
          {bucket.description !== '' && <CellSub>{bucket.description}</CellSub>}
        </span>
      ),
    },
    {
      key: 'practice',
      header: 'Practice',
      cell: (bucket) => <span className="break-words">{practiceName(bucket.practiceId) ?? '—'}</span>,
    },
    {
      key: 'insurances',
      header: 'Insurances',
      align: 'right',
      cell: (bucket) => <span className="tabular-nums">{bucket.insurancesCount}</span>,
    },
    activeColumn<ReleaseBucket>({
      isActive: (bucket) => bucket.isActive,
      label: (bucket) => bucket.name,
      // Asks first (StatusChangeDialog below).
      onChange: (bucket) => setStatusOf(bucket),
    }),
    actionsColumn<ReleaseBucket>((bucket) => (
      <>
        <RowActionButton action="edit" label={`Edit ${bucket.name}`} onClick={() => setEditing(bucket)} />
        <RowActionButton
          action="delete"
          label={`Delete ${bucket.name}`}
          onClick={() => setDeleting(bucket)}
        />
      </>
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
      {statusOf !== null && (
        <StatusChangeDialog
          name={statusOf.name}
          isActive={statusOf.isActive}
          onConfirm={() => setActive.mutateAsync({ id: statusOf.id, isActive: !statusOf.isActive })}
          onClose={() => setStatusOf(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? ''}?`}
        // What deleting does to its insurances is the server's to decide; only their number is stated.
        {...(deleting !== null && deleting.insurancesCount > 0
          ? {
              description: `${deleting.insurancesCount === 1 ? '1 insurance is' : `${deleting.insurancesCount} insurances are`} assigned to it.`,
            }
          : {})}
        confirmLabel="Delete bucket"
        tone="destructive"
        onConfirm={async () => {
          if (deleting === null) return
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? `${deleting.name} deleted`)
          } catch (error) {
            toast.error(
              `${deleting.name} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </PageContainer>
  )
}

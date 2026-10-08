import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useNavigate } from '@tanstack/react-router'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { useDeleteLocation, useDeletePractice, usePractice, usePractices } from '../queries/use-practices'
import type { Location, Practice } from '../schemas/practice'
import { LocationDialog } from './LocationDialog'
import { LocationStatusDialog } from './LocationStatusDialog'
import { PracticeDetails } from './PracticeDetails'
import { PracticeDialog } from './PracticeDialog'
import { PracticePicker } from './PracticePicker'

/** What is open over the screen. One at a time. */
type Editing =
  | { kind: 'practice'; practice: Practice | null }
  | { kind: 'location'; practice: Practice; location: Location | null }
  | { kind: 'location-status'; practice: Practice; location: Location }
  | { kind: 'delete'; practice: Practice }
  | { kind: 'location-delete'; location: Location }

/**
 * Admin → Practices & locations: pick a practice from its tile, then see that
 * practice full width — its header, then its billing details and its
 * locations as two separate cards. A tile shows only what tells practices
 * apart; the identifiers are in the details, once. (The prototype picks from a
 * table that repeats them.)
 *
 * The selected practice is in the URL (`?practice=<id>`) so a reload, the back
 * button and a shared link keep it; without one, the first practice is shown.
 * The tiles come from the list (summaries); the selected practice's details
 * and locations from its own record, read when it is chosen.
 *
 * Delete practice (from its header) asks first — its locations go with it,
 * as the server does — then shows the first practice. Delete on a location's
 * row asks first too.
 *
 * Not built, because nothing defines them: search or filters (the prototype
 * has none), moving a location to another practice (the server refuses it), and the prototype's primary-location and EMR-integration details
 * (absent from the payloads). Who may create a practice (a System Admin in the
 * prototype) is not checked: there is no permission model yet (ADR 0007), and
 * the server must enforce it regardless.
 */
export function PracticesScreen({ selectedId }: { selectedId: number | undefined }) {
  const practices = usePractices()
  const remove = useDeletePractice()
  const removeLocation = useDeleteLocation()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Editing | null>(null)

  const rows = practices.data ?? []
  const chosen = rows.find((practice) => practice.id === selectedId) ?? rows[0]
  const details = usePractice(chosen?.id ?? null)
  const selected = details.data

  const newPractice = (
    <Button
      variant="primary"
      icon={<Plus size={16} aria-hidden="true" />}
      onClick={() => setEditing({ kind: 'practice', practice: null })}
    >
      New practice
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Practices & locations"
        description="Create and manage your practices and their locations."
        actions={newPractice}
      />

      {practices.isPending ? (
        <div role="status" className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-3">
          <span className="sr-only">Loading…</span>
          <Skeleton className="rounded-card h-[74px]" />
          <Skeleton className="rounded-card h-[74px]" />
        </div>
      ) : practices.isError ? (
        <ErrorState onRetry={() => void practices.refetch()} />
      ) : chosen === undefined ? (
        <EmptyState
          icon={<Building2 size={20} />}
          title="No practices yet"
          description="Create your first practice. You add its first location at the same time."
          action={newPractice}
        />
      ) : (
        <PracticePicker practices={rows} selectedId={chosen.id} />
      )}

      {chosen !== undefined && details.isPending && (
        <div role="status" className="mt-8">
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="rounded-card mt-6 h-48" />
        </div>
      )}
      {details.isError && <ErrorState className="mt-8" onRetry={() => void details.refetch()} />}
      {selected !== undefined && (
        <PracticeDetails
          practice={selected}
          practicesInOrganization={
            rows.filter((practice) => practice.organizationId === selected.organizationId).length
          }
          onEditPractice={() => setEditing({ kind: 'practice', practice: selected })}
          onDeletePractice={() => setEditing({ kind: 'delete', practice: selected })}
          onAddLocation={() => setEditing({ kind: 'location', practice: selected, location: null })}
          onEditLocation={(location) => setEditing({ kind: 'location', practice: selected, location })}
          onToggleLocationActive={(location) =>
            setEditing({ kind: 'location-status', practice: selected, location })
          }
          onDeleteLocation={(location) => setEditing({ kind: 'location-delete', location })}
        />
      )}

      {editing?.kind === 'practice' && (
        <PracticeDialog
          key={editing.practice?.id ?? 'new'}
          practice={editing.practice}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'location-status' && (
        <LocationStatusDialog
          key={editing.location.id}
          location={editing.location}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'location' && (
        <LocationDialog
          key={editing.location?.id ?? 'new'}
          practice={editing.practice}
          location={editing.location}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={editing?.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        title={`Delete ${editing?.kind === 'delete' ? editing.practice.name : ''}?`}
        // The server deletes a practice's locations with it (seen on staging).
        {...(editing?.kind === 'delete' && editing.practice.locations.length > 0
          ? {
              description:
                editing.practice.locations.length === 1
                  ? 'Its location is deleted with it.'
                  : `Its ${editing.practice.locations.length} locations are deleted with it.`,
            }
          : {})}
        confirmLabel="Delete practice"
        tone="destructive"
        onConfirm={async () => {
          if (editing?.kind !== 'delete') return
          const { practice } = editing
          try {
            const message = await remove.mutateAsync(practice.id)
            toast.success(message ?? `${practice.name} deleted`)
            // Its id leaves the URL: the first practice is shown.
            void navigate({ to: '/admin/practices', search: {}, replace: true })
          } catch (error) {
            toast.error(
              `${practice.name} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
      <ConfirmDialog
        open={editing?.kind === 'location-delete'}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        title={`Delete ${editing?.kind === 'location-delete' ? editing.location.name : ''}?`}
        confirmLabel="Delete location"
        tone="destructive"
        onConfirm={async () => {
          if (editing?.kind !== 'location-delete') return
          const { location } = editing
          try {
            const message = await removeLocation.mutateAsync(location.id)
            toast.success(message ?? `${location.name} deleted`)
          } catch (error) {
            toast.error(
              `${location.name} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </PageContainer>
  )
}

import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useOrganizations } from '@/features/admin-organizations'
import { usePractices } from '../queries/use-practices'
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

/**
 * Admin → Practices & locations: pick a practice from its tile, then see that
 * practice full width — its header, then its billing details and its
 * locations as two separate cards. A tile shows only what tells practices
 * apart; the identifiers are in the details, once. (The prototype picks from a
 * table that repeats them.)
 *
 * The selected practice is in the URL (`?practice=<id>`) so a reload, the back
 * button and a shared link keep it; without one, the first practice is shown.
 *
 * Not built, because nothing defines them: search or filters (the prototype
 * has none), deleting a practice or location, moving a location to another
 * practice, and the prototype's primary-location and EMR-integration details
 * (absent from the payloads). Who may create a practice (a System Admin in the
 * prototype) is not checked: there is no permission model yet (ADR 0007), and
 * the server must enforce it regardless.
 */
export function PracticesScreen({ selectedId }: { selectedId: number | undefined }) {
  const practices = usePractices()
  const organizations = useOrganizations()
  const [editing, setEditing] = useState<Editing | null>(null)

  const rows = practices.data ?? []
  const selected = rows.find((practice) => practice.id === selectedId) ?? rows[0]
  const organization =
    selected?.organizationId == null
      ? undefined
      : organizations.data?.find((candidate) => candidate.id === selected.organizationId)

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
      ) : selected === undefined ? (
        <EmptyState
          icon={<Building2 size={20} />}
          title="No practices yet"
          description="Create your first practice. You add its first location at the same time."
          action={newPractice}
        />
      ) : (
        <PracticePicker practices={rows} selectedId={selected.id} />
      )}

      {selected !== undefined && (
        <PracticeDetails
          practice={selected}
          organization={organization}
          practicesInOrganization={
            rows.filter((practice) => practice.organizationId === selected.organizationId).length
          }
          onEditPractice={() => setEditing({ kind: 'practice', practice: selected })}
          onAddLocation={() => setEditing({ kind: 'location', practice: selected, location: null })}
          onEditLocation={(location) => setEditing({ kind: 'location', practice: selected, location })}
          onToggleLocationActive={(location) =>
            setEditing({ kind: 'location-status', practice: selected, location })
          }
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
          practice={editing.practice}
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
    </PageContainer>
  )
}

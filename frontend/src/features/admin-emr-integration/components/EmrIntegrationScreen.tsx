import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plug } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { StatusDot } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useCurrentUser } from '@/features/auth'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { todayIso } from '@/lib/utils/dates'
import { useEmrIntegration } from '../data/integration-store'
import { plural, summarize } from '../model/summary'
import { IntegrationSteps } from './IntegrationSteps'
import { LocationsSection, type Location, type LocationRow } from './LocationsSection'
import { PayloadLogSection } from './PayloadLogSection'
import { RequestIntegrationDialog } from './RequestIntegrationDialog'

/** A change waiting for the user's yes. */
type Confirming = { kind: 'approve' | 'elect'; row: LocationRow }

/**
 * Admin → EMR integration, as the prototype has it, kept light: the
 * prototype's three steps (a stepper); then the practice it is about, chosen
 * in a filter bar as on the other practice-scoped screens (it scopes
 * everything below); then two sections set apart by space
 * rather than boxes — **Locations** (how far they are linked, then Unique
 * Location ID, link, billing election, last payload, and the one action each
 * location's state allows: Request integration, Approve & link, or switching
 * its election) and the **Payload log** (filtered by result, 10 a page). Every
 * action asks or opens a dialog with the prototype's wording, and says what
 * happened in a toast.
 *
 * The locations are the practices list's (a real contract). Their integration
 * and the payload log have **no backend**: they live in this browser tab
 * (`data/integration-store.ts`), and nothing here talks to an EMR. That is
 * architecture, not product: the screen shows no message about it. Outside
 * development the payload log is empty — only a backend can fill it.
 *
 * The practice is kept in the URL (`?practice=<id>`, an opaque id); with none,
 * the first practice is shown — the prototype shows the current practice.
 *
 * Not built: the prototype offers each action only to users whose role allows
 * it (and "Awaiting approval" to those who cannot approve); there is no
 * permission model here yet (docs/FRONTEND_ARCHITECTURE.md §8). Nor the
 * payload log's "Open" link to the visit: there is no visit screen yet.
 */
export function EmrIntegrationScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const practices = usePractices()
  const currentUser = useCurrentUser()
  const emr = useEmrIntegration()
  const [requesting, setRequesting] = useState<Location | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const navigate = useNavigate()

  const all = practices.data ?? []
  const practice = all.find((item) => item.id === practiceFilter) ?? all[0]
  const locations = practice?.locations ?? []
  const locationName = (id: number) => locations.find((location) => location.id === id)?.name ?? '—'
  const loading = practices.isPending || !emr.ready

  const choose = (value: string | null) =>
    void navigate({
      to: '/admin/integration',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  // The log of this practice's locations, newest first.
  const practiceLog = emr.payloads
    .filter((payload) => locations.some((location) => location.id === payload.locationId))
    .sort((a, b) => b.at.localeCompare(a.at))
  const rows: LocationRow[] = locations.map((location) => ({
    location,
    integration: emr.integrationOf(location.id),
    last: practiceLog.find((payload) => payload.locationId === location.id),
  }))
  const summary = summarize(rows.map((row) => row.integration))

  const onConfirm = () => {
    if (confirming === null) return
    const { location, integration } = confirming.row
    if (confirming.kind === 'approve') {
      emr.approve(location.id, todayIso())
      toast.success(`${location.name} linked`, 'Switch it to Integrated to send its sessions into billing.')
    } else {
      const election = integration.election === 'Integrated' ? 'EMR only' : 'Integrated'
      emr.elect(location.id, election)
      toast.success(`${location.name} is now ${election}`)
    }
  }

  const confirmCopy = (() => {
    if (confirming === null) return null
    const { location, integration } = confirming.row
    if (confirming.kind === 'approve')
      return {
        title: `Link ${location.name} to the EMR?`,
        description: `Unique Location ID ${integration.uniqueLocationId} is mapped 1:1. The location stays EMR-only until someone elects it for billing.`,
        confirmLabel: 'Approve & link',
        tone: 'default' as const,
      }
    return integration.election === 'Integrated'
      ? {
          title: `Make ${location.name} EMR-only?`,
          description:
            'New payloads from this location are blocked from billing. Data already in billing is not changed.',
          confirmLabel: 'Switch to EMR-only',
          tone: 'destructive' as const,
        }
      : {
          title: `Bill ${location.name} through the platform?`,
          description:
            'From now on its sessions, charges, patient charts, cases and providers flow into billing.',
          confirmLabel: 'Switch to integrated',
          tone: 'default' as const,
        }
  })()

  return (
    <PageContainer>
      <PageHeader
        title="EMR integration"
        description="Integration is set up per location. Only integrated locations send sessions into billing."
      />

      <IntegrationSteps />

      {/* The practice comes after the steps, which are about every practice, and
          before what is about this one. A filter bar, as on the other
          practice-scoped screens; the page is one practice's, so a practice is
          always chosen: no "All practices". */}
      {!practices.isError && practices.data?.length !== 0 && (
        <FilterBar className="mt-5">
          <PracticeSelect
            aria-label="Practice"
            value={practice === undefined ? null : String(practice.id)}
            onChange={choose}
            className="w-full sm:w-64"
          />
        </FilterBar>
      )}

      {practices.isError ? (
        <ErrorState onRetry={() => void practices.refetch()} />
      ) : !practices.isPending && practice === undefined ? (
        <EmptyState
          icon={<Plug size={20} />}
          title="No practice yet"
          description="EMR integration is set up per location. Create the practice and its primary location first."
        />
      ) : (
        // Whitespace, not boxes, sets the two parts apart.
        <div className="flex flex-col gap-8">
          <LocationsSection
            practiceName={practice?.name ?? ''}
            status={
              loading ? null : (
                <>
                  <span>
                    <span className="text-ink font-medium tabular-nums">{summary.linked}</span> of{' '}
                    {plural(summary.locations, 'location')} linked
                  </span>
                  <span>
                    <span className="text-ink font-medium tabular-nums">{summary.integrated}</span> integrated
                  </span>
                  {summary.awaiting > 0 && (
                    <StatusDot tone="warning">{summary.awaiting} awaiting approval</StatusDot>
                  )}
                </>
              )
            }
            rows={rows}
            loading={loading}
            onRequest={(row) => setRequesting(row.location)}
            onApprove={(row) => setConfirming({ kind: 'approve', row })}
            onElect={(row) => setConfirming({ kind: 'elect', row })}
          />
          {/* Keyed by practice: its filter and page start over with each practice. */}
          <PayloadLogSection
            key={practice?.id ?? 'none'}
            payloads={practiceLog}
            locationName={locationName}
            loading={loading}
          />
        </div>
      )}

      {requesting !== null && (
        <RequestIntegrationDialog
          locationName={requesting.name}
          isTaken={(id) => {
            const owner = emr.uniqueIdOwner(id)
            return owner !== undefined && owner !== requesting.id
          }}
          onSend={(values) => {
            emr.request(requesting.id, {
              uniqueLocationId: values.uniqueLocationId,
              note: values.note,
              requestedBy: currentUser.data?.name ?? null,
              requestedOn: todayIso(),
            })
            toast.success('Integration requested', 'It waits for approval before the location is linked.')
          }}
          onClose={() => setRequesting(null)}
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        title={confirmCopy?.title ?? ''}
        {...(confirmCopy === null ? {} : { description: confirmCopy.description })}
        confirmLabel={confirmCopy?.confirmLabel ?? ''}
        tone={confirmCopy?.tone ?? 'default'}
        icon={confirmCopy?.tone === 'destructive' ? undefined : <Plug size={20} />}
        onConfirm={onConfirm}
      />
    </PageContainer>
  )
}

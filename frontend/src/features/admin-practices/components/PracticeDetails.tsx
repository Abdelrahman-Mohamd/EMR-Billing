import { useId } from 'react'
import { Link } from '@tanstack/react-router'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { StatusDot } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CardGroup, DetailCard } from '@/components/ui/DetailCard'
import { KeyValue } from '@/components/ui/KeyValue'
import { formatAddress } from '../model/format-address'
import type { Location, Practice } from '../schemas/practice'
import { LocationsTable } from './LocationsTable'

/**
 * The selected practice, full width: a header that says which practice this
 * is (name; code, DBA, status, organization; Edit), then two cards in the
 * record-page style (`DetailCard`, as on the patient chart and the visit page)
 * — Billing details, in groups, and Locations — each with its title band and
 * action.
 */
export function PracticeDetails({
  practice,
  practicesInOrganization,
  onEditPractice,
  onDeletePractice,
  onAddLocation,
  onEditLocation,
  onToggleLocationActive,
  onDeleteLocation,
}: {
  practice: Practice
  practicesInOrganization: number
  onEditPractice: () => void
  onDeletePractice: () => void
  onAddLocation: () => void
  onEditLocation: (location: Location) => void
  onToggleLocationActive: (location: Location) => void
  onDeleteLocation: (location: Location) => void
}) {
  const nameId = useId()
  const activeLocations = practice.locations.filter((location) => location.isActive).length

  return (
    <section aria-labelledby={nameId} className="mt-8">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <h2 id={nameId} className="text-section text-ink leading-tight font-medium break-words">
            {practice.name}
          </h2>
          <p className="text-meta text-n500 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Code <span className="text-ink font-medium tabular-nums">{practice.code}</span>
            </span>
            {practice.dbaName !== undefined && (
              <span className="break-words">
                DBA <span className="text-ink">{practice.dbaName}</span>
              </span>
            )}
            {practice.isActive ? (
              <StatusDot tone="success">Active</StatusDot>
            ) : (
              <StatusDot tone="inert">Inactive</StatusDot>
            )}
            {practice.organizationName !== undefined && (
              <span className="inline-flex flex-wrap items-center gap-x-1.5">
                <Link
                  to="/admin/organizations"
                  className="text-brand-deep hover:text-ink relative inline-flex items-center gap-1.5 font-medium break-words after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']"
                >
                  <Layers size={15} aria-hidden="true" className="flex-none" />
                  <span className="sr-only">Organization: </span>
                  {practice.organizationName}
                </Link>
                <span>
                  · {practicesInOrganization === 1 ? '1 practice' : `${practicesInOrganization} practices`}
                </span>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Pencil size={15} aria-hidden="true" />} onClick={onEditPractice}>
            Edit practice
          </Button>
          <Button variant="danger" icon={<Trash2 size={15} aria-hidden="true" />} onClick={onDeletePractice}>
            Delete practice
          </Button>
        </div>
      </header>

      {/* A card per topic, as on the patient chart and the visit page. */}
      <DetailCard
        className="mt-6"
        headingLevel={3}
        title="Billing details"
        info="Printed on every claim this practice sends (CMS-1500 boxes 25, 32a and 33)."
      >
        {/* Two groups side by side from 768px, each read top to bottom. */}
        <div className="grid gap-y-7 pt-4 md:grid-cols-2 md:gap-x-10">
          <CardGroup title="Billing address">
            <KeyValue layout="rows" items={[{ label: 'Address', value: formatAddress(practice.address) }]} />
          </CardGroup>
          <CardGroup title="Identifiers">
            <KeyValue
              layout="rows"
              items={[
                { label: 'Tax ID', value: practice.taxId },
                { label: 'Taxonomy code', value: practice.taxonomyCode },
                { label: 'Group NPI', value: practice.npi },
              ]}
            />
          </CardGroup>
        </div>
      </DetailCard>

      <DetailCard
        className="mt-4"
        headingLevel={3}
        title="Locations"
        info="A practice needs at least one location."
        meta={
          activeLocations === practice.locations.length
            ? `${practice.locations.length} ${practice.locations.length === 1 ? 'location' : 'locations'}`
            : `${activeLocations} of ${practice.locations.length} active`
        }
        aside={
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={onAddLocation}>
            Add location
          </Button>
        }
      >
        <div className="mt-2">
          <LocationsTable
            locations={practice.locations}
            onEdit={onEditLocation}
            onToggleActive={onToggleLocationActive}
            onDelete={onDeleteLocation}
          />
        </div>
      </DetailCard>
    </section>
  )
}

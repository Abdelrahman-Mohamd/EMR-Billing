import { useId } from 'react'
import { Link } from '@tanstack/react-router'
import { Layers, Pencil, Plus } from 'lucide-react'
import { StatusDot } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { KeyValue } from '@/components/ui/KeyValue'
import type { Organization } from '@/features/admin-organizations'
import { formatAddress } from '../model/format-address'
import type { Location, Practice } from '../schemas/practice'
import { LocationsTable } from './LocationsTable'

/**
 * The selected practice, full width: a header that says which practice this
 * is (name; code, DBA, status, organization; Edit), then two separate cards —
 * its billing details and its locations — each with its own title and action.
 */
export function PracticeDetails({
  practice,
  organization,
  practicesInOrganization,
  onEditPractice,
  onAddLocation,
  onEditLocation,
  onToggleLocationActive,
}: {
  practice: Practice
  /** `undefined` when the practice is in none, or its organization is not loaded. */
  organization: Organization | undefined
  practicesInOrganization: number
  onEditPractice: () => void
  onAddLocation: () => void
  onEditLocation: (location: Location) => void
  onToggleLocationActive: (location: Location) => void
}) {
  const nameId = useId()
  const billingId = useId()
  const locationsId = useId()
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
            {organization !== undefined && (
              <span className="inline-flex flex-wrap items-center gap-x-1.5">
                <Link
                  to="/admin/organizations"
                  className="text-brand-deep hover:text-ink relative inline-flex items-center gap-1.5 font-medium break-words after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']"
                >
                  <Layers size={15} aria-hidden="true" className="flex-none" />
                  <span className="sr-only">Organization: </span>
                  {organization.name}
                </Link>
                <span>
                  · {practicesInOrganization === 1 ? '1 practice' : `${practicesInOrganization} practices`}
                </span>
              </span>
            )}
          </p>
        </div>
        <Button icon={<Pencil size={15} aria-hidden="true" />} onClick={onEditPractice}>
          Edit practice
        </Button>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <Card labelledBy={billingId}>
          <CardHeader
            id={billingId}
            title="Billing details"
            info="Printed on every claim this practice sends (CMS-1500 boxes 25, 32a and 33)."
          />
          <CardBody className="pt-1 pb-5">
            <KeyValue
              items={[
                { label: 'Billing address', value: formatAddress(practice.address), wide: true },
                { label: 'Tax ID', value: practice.taxId },
                { label: 'Taxonomy code', value: practice.taxonomyCode },
                { label: 'Group NPI', value: practice.npi },
              ]}
            />
          </CardBody>
        </Card>

        <Card labelledBy={locationsId}>
          <CardHeader
            id={locationsId}
            title={
              <>
                Locations{' '}
                <span className="text-n500 font-normal tabular-nums">
                  {activeLocations === practice.locations.length
                    ? practice.locations.length
                    : `${activeLocations} of ${practice.locations.length} active`}
                </span>
              </>
            }
            info="A practice needs at least one location."
            infoLabel="About locations"
            aside={
              <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={onAddLocation}>
                Add location
              </Button>
            }
          />
          <CardBody className="pt-0 pb-2">
            <LocationsTable
              locations={practice.locations}
              onEdit={onEditLocation}
              onToggleActive={onToggleLocationActive}
            />
          </CardBody>
        </Card>
      </div>
    </section>
  )
}

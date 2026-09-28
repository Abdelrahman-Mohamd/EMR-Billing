import { Link } from '@tanstack/react-router'
import { Layers, Pencil, Plus } from 'lucide-react'
import { StatusDot } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Card'
import { KeyValue } from '@/components/ui/KeyValue'
import type { Organization } from '@/features/admin-organizations'
import { formatAddress } from '../model/format-address'
import type { Location, Practice } from '../schemas/practice'
import { LocationsTable } from './LocationsTable'

/**
 * The selected practice: its organization (when it is in one), the billing
 * constants, and its locations — the lower half of the prototype's screen.
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
  return (
    <>
      {organization !== undefined && (
        <section
          aria-label="Organization"
          className="border-rule-structural bg-paper rounded-card mt-6 flex flex-wrap items-center gap-3 border p-4"
        >
          <span
            aria-hidden="true"
            className="bg-brand-wash text-brand-deep grid size-9 flex-none place-items-center rounded-md"
          >
            <Layers size={18} />
          </span>
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-eyebrow text-n500 font-medium uppercase">Organization</p>
            <p className="text-row text-ink font-medium [overflow-wrap:anywhere]">{organization.name}</p>
            <p className="text-micro text-n500">
              Includes {practicesInOrganization === 1 ? '1 practice' : `${practicesInOrganization} practices`}
              .
            </p>
          </div>
          <Link to="/admin/organizations" className="text-meta text-brand font-medium">
            Manage organizations
          </Link>
        </section>
      )}

      <Section
        title={<span className="[overflow-wrap:anywhere]">{practice.name}</span>}
        aside={
          <Button size="sm" icon={<Pencil size={14} aria-hidden="true" />} onClick={onEditPractice}>
            Edit practice
          </Button>
        }
      >
        <p className="text-micro text-n500 pt-2">
          Billing constants printed on every claim (Boxes 25, 32a, 33).
        </p>
        <KeyValue
          items={[
            { label: 'Practice code', value: practice.code },
            { label: 'DBA name', value: practice.dbaName },
            { label: 'Billing address', value: formatAddress(practice.address), wide: true },
            { label: 'Tax ID', value: practice.taxId },
            { label: 'Taxonomy code', value: practice.taxonomyCode },
            { label: 'Group NPI', value: practice.npi },
            {
              label: 'Status',
              value: practice.isActive ? (
                <StatusDot tone="success">Active</StatusDot>
              ) : (
                <StatusDot tone="inert">Inactive</StatusDot>
              ),
            },
          ]}
        />
      </Section>

      <Section
        title="Locations"
        aside={
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={onAddLocation}>
            Add location
          </Button>
        }
      >
        <p className="text-micro text-n500 pt-2">A practice needs at least one location.</p>
        <LocationsTable
          locations={practice.locations}
          onEdit={onEditLocation}
          onToggleActive={onToggleLocationActive}
        />
      </Section>
    </>
  )
}

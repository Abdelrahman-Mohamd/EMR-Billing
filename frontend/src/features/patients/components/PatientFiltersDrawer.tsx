import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { DEFAULT_FILTERS, STATUS_FILTERS, type PatientFilters } from '../model/roster'

/**
 * The prototype's "Filter patients" drawer: primary insurance and status. The
 * choices apply when Search is pressed; Reset puts them back to the default
 * (any insurance, Active).
 *
 * Not offered, because what they filter on does not exist yet: the location
 * (it lives on the visit) and "Only patients with an open balance" (from billed
 * charges).
 */
export function PatientFiltersDrawer({
  filters,
  insuranceNames,
  onApply,
  onClose,
}: {
  filters: PatientFilters
  insuranceNames: readonly string[]
  onApply: (filters: PatientFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(filters)
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Filter patients"
      description="Filters apply when you press Search."
      footer={
        <>
          <Button variant="quiet" onClick={() => setDraft(DEFAULT_FILTERS)}>
            Reset
          </Button>
          <Button
            variant="primary"
            icon={<Search size={16} aria-hidden="true" />}
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            Search
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <Field label="Primary insurance">
          <Select
            value={draft.insurance === '' ? null : draft.insurance}
            onChange={(next) => setDraft({ ...draft, insurance: next ?? '' })}
            options={insuranceNames.map((name) => ({ value: name, label: name }))}
            placeholder="Any insurance"
            clearable
          />
        </Field>
        <Field label="Status">
          <Select
            value={draft.status}
            onChange={(next) => {
              const status = STATUS_FILTERS.find((option) => option === next)
              if (status !== undefined) setDraft({ ...draft, status })
            }}
            options={STATUS_FILTERS.map((status) => ({ value: status, label: status }))}
          />
        </Field>
      </div>
    </Drawer>
  )
}

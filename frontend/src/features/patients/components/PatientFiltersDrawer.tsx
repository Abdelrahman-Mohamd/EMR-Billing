import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { DEFAULT_FILTERS, STATUS_FILTERS, type PatientFilters } from '../model/roster'

/**
 * The prototype's "Filter patients" drawer: status. The choice applies when
 * Search is pressed; Reset puts it back to the default (Active).
 *
 * Not offered, because the patient list does not carry what they filter on:
 * the primary insurance (a case's coverage), the location (it lives on the
 * visit) and "Only patients with an open balance" (from billed charges).
 */
export function PatientFiltersDrawer({
  filters,
  onApply,
  onClose,
}: {
  filters: PatientFilters
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
        <Field label="Status">
          <Select
            value={draft.status}
            onChange={(next) => {
              const status = STATUS_FILTERS.find((option) => option === next)
              if (status !== undefined) setDraft({ status })
            }}
            options={STATUS_FILTERS.map((status) => ({ value: status, label: status }))}
          />
        </Field>
      </div>
    </Drawer>
  )
}

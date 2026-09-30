import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { StatusDot } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { Practice } from '../schemas/practice'

/**
 * Choose which practice to see: one tile per practice, full width, wrapping.
 *
 * A tile carries only what tells practices apart — name, code, how many
 * active locations — and Inactive when it applies. Every identifier (NPI, Tax
 * ID, taxonomy) is in the selected practice's details, not repeated here.
 *
 * Each tile is a link (`?practice=<id>`), so choosing is navigation: the back
 * button, a reload and a shared link keep the choice. The chosen tile is
 * outlined in brand and marked `aria-current`.
 */
export function PracticePicker({
  practices,
  selectedId,
}: {
  practices: readonly Practice[]
  selectedId: number
}) {
  return (
    <nav aria-label="Practices">
      <p className="text-eyebrow text-n500 mb-2.5 font-medium uppercase">
        {practices.length === 1 ? '1 practice' : `${practices.length} practices`}
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-3">
        {practices.map((practice) => {
          const selected = practice.id === selectedId
          const activeLocations = practice.locations.filter((location) => location.isActive).length
          return (
            <li key={practice.id} className="flex">
              <Link
                to="/admin/practices"
                search={{ practice: practice.id }}
                replace
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'rounded-card flex w-full items-start gap-3 border px-4 py-3.5 no-underline transition-colors',
                  selected
                    ? 'border-brand bg-brand-wash ring-brand ring-1'
                    : 'border-rule-structural bg-canvas hover:border-n300 hover:bg-paper',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'text-meta block font-medium break-words',
                      selected ? 'text-brand-deep' : 'text-ink',
                    )}
                  >
                    {practice.name}
                  </span>
                  <span className="text-micro text-n500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="tabular-nums">{practice.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeLocations === 1 ? '1 location' : `${activeLocations} locations`}</span>
                    {!practice.isActive && <StatusDot tone="inert">Inactive</StatusDot>}
                  </span>
                </span>
                {selected && (
                  <CircleCheck size={18} aria-hidden="true" className="text-brand mt-0.5 flex-none" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

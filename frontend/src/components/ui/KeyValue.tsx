import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The read-only view of a record: label above value, wrapping into columns.
 * A real `<dl>`, so the pairing survives a screen reader.
 *
 * An empty value renders as a dash in a lighter grey rather than as nothing,
 * because "no value" and "no field" must not look the same on a billing record.
 *
 * A value's own details — a relationship, an NPI, the second line of an
 * address — go in `sub`, a quieter line under it, rather than run on after a
 * dot. `columns` fixes the grid, so related fields sit in rows that line up
 * instead of flowing wherever they fit; without it, the columns fill the room.
 *
 * `layout="rows"` is a two-column table: one field a row, the label at the
 * left and the value beside it, a hairline under each row as in `DataTable` —
 * so a value's details plainly belong to its row (user, 2026-10-09: the labels
 * and the details looked alike and the fields ran together).
 */
export interface KeyValueItem {
  label: string
  value: ReactNode
  /** The value's own details, on a quieter line under it. */
  sub?: ReactNode
  /** Force a full-width row — an address, a note. */
  wide?: boolean
  /** Two columns wide, where the grid has room for it. */
  span?: 2
}

// Whole class names, so Tailwind sees them. Short values fit two to a row on a
// phone; longer ones (an email, an address) take the row.
const COLUMNS = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
} as const

export function KeyValue({
  items,
  columns,
  layout = 'stacked',
  className,
}: {
  items: readonly KeyValueItem[]
  columns?: keyof typeof COLUMNS
  layout?: 'stacked' | 'rows'
  className?: string
}) {
  if (layout === 'rows')
    return (
      <dl className={cn('grid', className)}>
        {items.map((item) => (
          <div
            key={item.label}
            className="border-rule-row grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 border-b py-2"
          >
            <dt className="text-micro text-n500">{item.label}</dt>
            <dd className="text-meta text-ink min-w-0 leading-snug break-words">
              <Value item={item} />
            </dd>
          </div>
        ))}
      </dl>
    )
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4 pt-3.5 pb-1',
        columns === undefined ? 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]' : COLUMNS[columns],
        className,
      )}
    >
      {items.map((item) => {
        const empty = isEmpty(item.value)
        return (
          <div
            key={item.label}
            className={cn(
              'min-w-0',
              item.wide === true && 'col-span-full',
              item.span === 2 && 'col-span-full sm:col-span-2',
            )}
          >
            <dt className="text-eyebrow text-n500 font-medium uppercase">{item.label}</dt>
            <dd className={cn('text-meta mt-1 leading-snug break-words', empty ? 'text-n400' : 'text-ink')}>
              <Value item={item} />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

const isEmpty = (value: ReactNode) => value === null || value === undefined || value === ''

/** A value, its details under it — or a dash, said as "None". */
function Value({ item }: { item: KeyValueItem }) {
  if (isEmpty(item.value))
    return (
      <span className="text-n400">
        {/* A dash is a shape, not a word: say "None" to a screen reader. */}
        <span aria-hidden="true">—</span>
        <span className="sr-only">None</span>
      </span>
    )
  return (
    <>
      {item.value}
      {item.sub !== undefined && item.sub !== '' && (
        <span className="text-micro text-n500 mt-0.5 block">{item.sub}</span>
      )}
    </>
  )
}

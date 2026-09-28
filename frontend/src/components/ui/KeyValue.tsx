import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The read-only view of a record: label above value, wrapping into columns.
 * A real `<dl>`, so the pairing survives a screen reader.
 *
 * An empty value renders as a dash in a lighter grey rather than as nothing,
 * because "no value" and "no field" must not look the same on a billing record.
 */
export interface KeyValueItem {
  label: string
  value: ReactNode
  /** Force a full-width row — an address, a note. */
  wide?: boolean
}

export function KeyValue({ items, className }: { items: readonly KeyValueItem[]; className?: string }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-4 pt-3.5 pb-1',
        className,
      )}
    >
      {items.map((item) => {
        const empty = item.value === null || item.value === undefined || item.value === ''
        return (
          <div key={item.label} className={cn('min-w-0', item.wide === true && 'col-span-full')}>
            <dt className="text-eyebrow text-n500 font-medium uppercase">{item.label}</dt>
            <dd className={cn('text-meta mt-1 leading-snug break-words', empty ? 'text-n400' : 'text-ink')}>
              {empty ? (
                <>
                  {/* A dash is a shape, not a word: say "None" to a screen reader. */}
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">None</span>
                </>
              ) : (
                item.value
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

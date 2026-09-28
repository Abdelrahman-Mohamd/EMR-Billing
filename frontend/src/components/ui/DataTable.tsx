import { type ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Checkbox } from './Choice'
import { EmptyState, ErrorState, SkeletonRows } from './States'

/**
 * The table every list screen uses.
 *
 * Deliberately not a data grid. It renders rows, reports what the user asked
 * for (sort, selection, a click) and shows the three states a list can be in.
 * It never sorts, filters or pages the data: billing lists are long, so the
 * server does that and the screen puts the parameters in the URL
 * (docs/PERFORMANCE.md §5).
 *
 * Opening a row: give it `rowLink` (the row goes somewhere) or `rowAction` (it
 * opens a drawer or a dialog). Either way the primary cell becomes one real
 * link or button that covers the whole row, so the row is clickable with a
 * mouse *and* reachable with a keyboard — a row that answers only to a mouse
 * is invisible to anyone who does not use one.
 */
export type SortDirection = 'asc' | 'desc'

export interface Sort {
  key: string
  direction: SortDirection
}

export interface Column<T> {
  /** Also the sort key sent to the server. */
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Emphasised column — the name or number a user scans for. One per table. */
  primary?: boolean
  width?: string
  /** Hidden below `sm`. Use for the columns a phone can live without. */
  hideOnMobile?: boolean
  /**
   * This cell holds its own controls (a menu, a button). It is lifted above the
   * row-wide link so those controls stay clickable.
   */
  interactive?: boolean
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<Column<T>>
  rows: readonly T[]
  getRowId: (row: T) => string
  /** Describes the table for screen readers, e.g. "Claims on hold". */
  caption: string
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  /** Rendered when there are no rows and nothing failed. */
  empty?: ReactNode
  sort?: Sort | undefined
  onSortChange?: (sort: Sort) => void
  selectedIds?: readonly string[]
  onSelectionChange?: (ids: string[]) => void
  /** Where the row goes. The primary cell becomes a link covering the row. */
  rowLink?: (row: T) => LinkProps
  /** What the row opens when it is not a URL. Use one of rowLink / rowAction. */
  rowAction?: { label: (row: T) => string; onAction: (row: T) => void }
  /** Pagination or a summary line, under the table. */
  footer?: ReactNode
  className?: string
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  loading = false,
  error = false,
  onRetry,
  empty,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  rowLink,
  rowAction,
  footer,
  className,
}: DataTableProps<T>) {
  const selectable = selectedIds !== undefined && onSelectionChange !== undefined
  const selected = new Set(selectedIds ?? [])
  const allIds = rows.map(getRowId)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = allIds.some((id) => selected.has(id)) && !allSelected

  if (error) return <ErrorState {...(onRetry === undefined ? {} : { onRetry })} />
  if (loading) return <SkeletonRows columns={columns.length} />
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>

  const toggleAll = () => {
    if (!onSelectionChange) return
    onSelectionChange(allSelected ? [] : allIds)
  }

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange([...next])
  }

  return (
    <div className={className}>
      {/* `relative`: an `sr-only` header label is absolutely positioned; without a
          positioned ancestor here it escapes this scroll box and widens the page. */}
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="w-[30px] pt-3.5 pr-1 pb-2.5">
                  <Checkbox
                    label={<span className="sr-only">Select all rows</span>}
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((column) => {
                const sorted = sort?.key === column.key ? sort.direction : undefined
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width === undefined ? undefined : { width: column.width }}
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className={cn(
                      'border-rule-structural text-eyebrow text-n500 border-b px-3 pt-3.5 pb-2.5 align-bottom font-medium whitespace-nowrap uppercase first:pl-0 last:pr-0',
                      ALIGN[column.align ?? 'left'],
                      column.hideOnMobile === true && 'hidden sm:table-cell',
                    )}
                  >
                    {column.sortable === true && onSortChange ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSortChange({
                            key: column.key,
                            direction: sorted === 'asc' ? 'desc' : 'asc',
                          })
                        }
                        className="hover:text-ink inline-flex items-center gap-1 uppercase"
                      >
                        {column.header}
                        {sorted === 'asc' ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown size={12} aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown size={12} aria-hidden="true" className="text-n400" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = getRowId(row)
              const isSelected = selected.has(id)
              const openable = rowLink !== undefined || rowAction !== undefined
              const targetColumn = columns.find((column) => column.primary === true) ?? columns[0]
              return (
                <tr
                  key={id}
                  className={cn(
                    'hover:bg-paper relative transition-colors duration-100',
                    openable && 'cursor-pointer',
                    isSelected && 'bg-brand-wash',
                  )}
                >
                  {selectable && (
                    // Lifted above the row-wide link so ticking a row does not open it.
                    <td className="relative z-[1] w-[30px] pr-1">
                      <Checkbox
                        label={<span className="sr-only">Select row</span>}
                        checked={isSelected}
                        onChange={() => toggleOne(id)}
                      />
                    </td>
                  )}
                  {columns.map((column) => {
                    const carriesRowTarget = openable && column === targetColumn
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'border-rule-row text-micro text-n500 border-b px-3 py-[11px] align-middle first:pl-0 last:pr-0',
                          ALIGN[column.align ?? 'left'],
                          column.primary === true && 'text-meta text-ink font-medium',
                          column.hideOnMobile === true && 'hidden sm:table-cell',
                          column.interactive === true && 'relative z-[1]',
                        )}
                      >
                        {carriesRowTarget && rowLink !== undefined ? (
                          <Link
                            {...rowLink(row)}
                            className="text-ink no-underline after:absolute after:inset-0 after:content-['']"
                          >
                            {column.cell(row)}
                          </Link>
                        ) : carriesRowTarget && rowAction !== undefined ? (
                          <button
                            type="button"
                            onClick={() => rowAction.onAction(row)}
                            aria-label={rowAction.label(row)}
                            className="text-ink text-left after:absolute after:inset-0 after:content-['']"
                          >
                            {column.cell(row)}
                          </button>
                        ) : (
                          column.cell(row)
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {footer !== undefined && (
        <div className="text-micro text-n500 flex flex-wrap items-center justify-between gap-3 pt-3.5">
          {footer}
        </div>
      )}
    </div>
  )
}

/** The second line inside a cell: a code under a name, a date under a status. */
export function CellSub({ children }: { children: ReactNode }) {
  return <span className="text-eyebrow text-n500 mt-px block font-normal">{children}</span>
}

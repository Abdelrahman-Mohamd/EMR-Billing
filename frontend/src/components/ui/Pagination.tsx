import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Page numbers only. It is told the current page and how many there are, and
 * reports what was clicked — it knows nothing about how the data is fetched,
 * so it works the same for an offset API and a page-number API.
 */
export interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Optional "1–25 of 340" line shown beside the controls. */
  summary?: string
  className?: string
}

/** Pages to show: first, last, current and its neighbours, with gaps marked. */
function pageItems(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const items: Array<number | 'gap'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) items.push('gap')
  for (let p = start; p <= end; p += 1) items.push(p)
  if (end < pageCount - 1) items.push('gap')
  items.push(pageCount)
  return items
}

export function Pagination({ page, pageCount, onPageChange, summary, className }: PaginationProps) {
  if (pageCount <= 1) return summary === undefined ? null : <span className={className}>{summary}</span>

  const item =
    'grid h-control-sm min-w-[32px] place-items-center rounded-sm px-2 text-micro text-n600 hover:bg-n50 hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center gap-3', className)}>
      {summary !== undefined && <span className="text-micro text-n500">{summary}</span>}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={item}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pageItems(page, pageCount).map((entry, index) =>
          entry === 'gap' ? (
            <span key={`gap-${index}`} aria-hidden="true" className="text-micro text-n400 px-1">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              className={cn(
                item,
                entry === page && 'bg-brand-wash text-brand-deep hover:bg-brand-wash font-medium',
              )}
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              aria-label={`Page ${entry}`}
            >
              {entry}
            </button>
          ),
        )}
        <button
          type="button"
          className={item}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

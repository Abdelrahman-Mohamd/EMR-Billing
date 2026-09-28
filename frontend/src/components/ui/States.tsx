import type { ReactNode } from 'react'
import { AlertCircle, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from './Button'

/**
 * Empty, loading and error are product behaviour, not decoration: every list
 * and every screen has all three, and they are the same three everywhere.
 */

export function EmptyState({
  icon,
  title,
  description,
  action,
  /**
   * Render the title as a real heading. Pass 1 when the empty state *is* the
   * page (a not-found screen); leave it off inside a card or a table, where a
   * stray heading would corrupt the page's outline.
   */
  headingLevel,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  headingLevel?: 1 | 2 | 3
  className?: string
}) {
  const Title = headingLevel === undefined ? 'p' : (`h${headingLevel}` as const)
  return (
    <div className={cn('flex flex-col items-center gap-2.5 px-6 py-11 text-center', className)}>
      <span
        aria-hidden="true"
        className="bg-brand-wash text-brand-deep grid size-10 place-items-center rounded-md"
      >
        {icon ?? <Inbox size={20} />}
      </span>
      <Title className="text-body text-ink font-medium">{title}</Title>
      {description !== undefined && (
        <p className="text-meta text-n500 max-w-[44ch] leading-relaxed">{description}</p>
      )}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  )
}

/**
 * A failed load. The message is written for the user; the underlying error is
 * never printed here — see docs/SECURITY.md "Error messages".
 */
export function ErrorState({
  title = 'This could not be loaded',
  description = 'Try again, and tell support what you were doing if it keeps happening.',
  onRetry,
  headingLevel,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  headingLevel?: 1 | 2 | 3
  className?: string
}) {
  const Title = headingLevel === undefined ? 'p' : (`h${headingLevel}` as const)
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-2.5 px-6 py-11 text-center', className)}>
      <span
        aria-hidden="true"
        className="bg-critical-bg text-critical grid size-10 place-items-center rounded-md"
      >
        <AlertCircle size={20} />
      </span>
      <Title className="text-body text-ink font-medium">{title}</Title>
      <p className="text-meta text-n500 max-w-[44ch] leading-relaxed">{description}</p>
      {onRetry && (
        <Button className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** A grey block standing in for content that is on its way. */
export function Skeleton({
  className,
  width,
  height,
}: {
  className?: string
  width?: number | string
  height?: number | string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('animate-pulse-soft bg-n100 block rounded-sm', className)}
      style={{ width, height: height ?? '1em' }}
    />
  )
}

/**
 * Rows of skeletons shaped like the table that is loading, so the layout does
 * not jump when the data lands. The bars are hidden from assistive technology;
 * a status says "Loading" in their place, so the wait is not silent.
 */
export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          aria-hidden="true"
          className="border-rule-row flex items-center gap-4 border-b py-[13px]"
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

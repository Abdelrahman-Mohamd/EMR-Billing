import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { SCROLL_MARGIN } from './chart-scroll'

/**
 * One group of the chart, on a card (user, 2026-10-02: the one-page chart
 * needs its content grouped, not just spaced): its title, a short line about
 * it beside the title (under it on a phone), its actions at the right, then
 * the content. The edge separates the groups, so nothing inside needs a rule
 * under its heading.
 */
export function ChartCard({
  id,
  title,
  description,
  aside,
  headingLevel = 2,
  className,
  children,
}: {
  /** For the chart's menu, which jumps to it. */
  id?: string
  title: string
  description?: ReactNode
  aside?: ReactNode
  /** 3 for the case's cards, which sit under the case's heading. */
  headingLevel?: 2 | 3
  className?: string
  children: ReactNode
}) {
  const headingId = useId()
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('rounded-card border-rule-structural bg-canvas border', SCROLL_MARGIN, className)}
    >
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 sm:flex-nowrap sm:px-5">
        <Heading id={headingId} className="text-row text-ink font-medium">
          {title}
        </Heading>
        {description !== undefined && (
          <p className="text-micro text-n500 order-3 min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
            {description}
          </p>
        )}
        {aside !== undefined && <div className="ml-auto flex flex-none items-center gap-2">{aside}</div>}
      </div>
      <div className="px-4 pb-5 sm:px-5">{children}</div>
    </section>
  )
}

/**
 * A group inside a card — the Profile's Demographics, Contact & address and
 * Guarantor: a smaller heading, set off from the group before it by a hairline.
 */
export function CardGroup({
  title,
  description,
  className,
  children,
}: {
  title: string
  description?: ReactNode
  className?: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={cn('min-w-0 pt-4', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <h3 id={headingId} className="text-meta text-n700 font-medium">
          {title}
        </h3>
        {description !== undefined && <p className="text-micro text-n500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

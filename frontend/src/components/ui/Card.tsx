import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { InfoTip } from './InfoTip'

/**
 * A hairline box. The approved design uses cards sparingly — whitespace and a
 * rule do most of the separating — so reach for `Section` first and use a card
 * when a block genuinely needs an edge.
 */
export function Card({
  children,
  className,
  labelledBy,
}: {
  children: ReactNode
  className?: string
  /** The id of the card's heading: the card becomes a named region. */
  labelledBy?: string
}) {
  const classes = cn('rounded-card border-rule-structural bg-canvas border', className)
  return labelledBy === undefined ? (
    <div className={classes}>{children}</div>
  ) : (
    <section aria-labelledby={labelledBy} className={classes}>
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  id,
  info,
  infoLabel,
  aside,
  className,
}: {
  title: ReactNode
  /** Give it, and the same id to Card's `labelledBy`, to name the card. */
  id?: string
  /** Optional context about the card, behind an info icon beside the title. */
  info?: ReactNode
  /** The info icon's name when `title` is not plain text. */
  infoLabel?: string
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('border-rule-row flex min-h-14 items-center gap-2.5 border-b px-5 py-3', className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <h3 id={id} className="text-body text-ink font-medium">
          {title}
        </h3>
        {info !== undefined && (
          <InfoTip label={infoLabel ?? (typeof title === 'string' ? `About ${title}` : 'More information')}>
            {info}
          </InfoTip>
        )}
      </div>
      {aside !== undefined && <div className="ml-auto flex items-center gap-2">{aside}</div>}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}

/**
 * A titled block on a page, separated by space and a rule rather than a box.
 * This is the default grouping in the approved design.
 *
 * `info` puts the shared info icon beside the title — beside it, not inside
 * the heading, so the heading's name stays just the title. The section is
 * named by its heading, so it is a landmark a screen reader can jump to.
 *
 * `description` is the prototype's section subtitle: a short line set beside
 * the title (under it when there is no room), outside the heading too.
 */
export function Section({
  title,
  info,
  infoLabel,
  aside,
  description,
  headingLevel = 2,
  id,
  children,
  className,
}: {
  title: ReactNode
  /** A short line beside the title, e.g. "Required for billing: date of birth, gender, address". */
  description?: ReactNode
  /** 3 when the section sits under another heading on the page (a detail pane's). */
  headingLevel?: 2 | 3
  /** For an in-page menu that jumps to the section. */
  id?: string
  /** Optional context about the whole section, behind an info icon. */
  info?: ReactNode
  /** The info icon's name when `title` is not plain text, e.g. "About locations". */
  infoLabel?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  const headingId = useId()
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <section id={id} aria-labelledby={headingId} className={cn('py-6', className)}>
      {/* A phone puts the title and the actions on the first row and the
          description under them, full width, as the prototype does. */}
      <div className="border-rule-row flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2.5 sm:flex-nowrap">
        <div className="flex min-w-0 items-center gap-1.5">
          <Heading id={headingId} className="text-row text-ink font-medium">
            {title}
          </Heading>
          {info !== undefined && (
            <InfoTip label={infoLabel ?? (typeof title === 'string' ? `About ${title}` : 'More information')}>
              {info}
            </InfoTip>
          )}
        </div>
        {description !== undefined && (
          <p className="text-micro text-n500 order-3 min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
            {description}
          </p>
        )}
        {aside !== undefined && <div className="ml-auto flex flex-none items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

import { useId, type ReactNode } from 'react'
import { InfoTip } from './InfoTip'
import { cn } from '@/lib/utils/cn'

/**
 * One group of a record's page, on a card — the patient chart's Profile, Case
 * details, Insurance…, a visit's details, charge lines and claims (user,
 * 2026-10-09: the visit page reuses the chart's cards). Its title — what the
 * card is about behind an info icon beside it, a short status after it (a
 * count, a requirement) — its actions at the right, then the content. The
 * title sits on a band of its own, ruled off from the content, so each card
 * plainly starts at its band and ends at its edge.
 *
 * Actions that act on the whole card name what they act on ("Edit case",
 * "Add charge line"); a row's own actions inside it are the tables' icon
 * buttons. The groups inside a card are `CardGroup`s; an empty card says so in
 * one line, `CardEmpty`.
 */
export function DetailCard({
  id,
  title,
  info,
  meta,
  aside,
  headingLevel = 2,
  className,
  children,
}: {
  /** For an in-page menu that jumps to it. */
  id?: string
  title: string
  /** What the card is about, behind an info icon beside the title. */
  info?: string
  /** A short status beside the title: "3 of 12", a requirement. */
  meta?: ReactNode
  aside?: ReactNode
  /** 3 when the card sits under another heading on the page. */
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
      className={cn('rounded-card border-rule-structural bg-canvas border', className)}
    >
      <div className="bg-paper border-rule-structural rounded-t-card flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 sm:px-5">
        {/* Room for the title and its status before the actions: when both do not
            fit, the actions drop to the next line rather than squeeze the title. */}
        <span className="flex min-w-0 flex-auto flex-wrap items-center gap-x-2 gap-y-1">
          <Heading id={headingId} className="text-row text-ink font-semibold">
            {title}
          </Heading>
          {info !== undefined && <InfoTip label={`About ${title}`}>{info}</InfoTip>}
          {meta !== undefined && <span className="text-micro text-n500 flex items-center gap-2">{meta}</span>}
        </span>
        {aside !== undefined && <div className="ml-auto flex flex-none items-center gap-2">{aside}</div>}
      </div>
      <div className="px-4 pb-5 sm:px-5">{children}</div>
    </section>
  )
}

/**
 * A card with nothing in it yet: one quiet line — what is missing, then what
 * to do — rather than an illustrated block, so an empty card does not take a
 * screen of the page.
 */
export function CardEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <p className="text-meta text-n500 pt-3 leading-snug">
      <span className="text-ink font-medium">{title}</span>. {children}
    </p>
  )
}

/**
 * A group inside a card — the Profile's Demographics, a visit's Location &
 * providers: a small capitalised heading on a rule, like a table's header row,
 * over its fields (`KeyValue layout="rows"`), so each group reads as one table.
 * The cards lay their groups out with space between them, not lines.
 */
export function CardGroup({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={cn('min-w-0', className)}>
      <h3
        id={headingId}
        className="border-rule-structural text-eyebrow text-brand-deep border-b pb-2.5 font-semibold uppercase"
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

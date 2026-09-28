import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * A hairline box. The approved design uses cards sparingly — whitespace and a
 * rule do most of the separating — so reach for `Section` first and use a card
 * when a block genuinely needs an edge.
 */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-card border-rule-structural bg-canvas border', className)}>{children}</div>
  )
}

export function CardHeader({
  title,
  aside,
  className,
}: {
  title: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('border-rule-row flex items-center gap-2.5 border-b px-5 py-3.5', className)}>
      <h3 className="text-body text-ink font-medium">{title}</h3>
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
 */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('py-6', className)}>
      <div className="border-rule-row flex items-center gap-3 border-b pb-2.5">
        <h2 className="text-row text-ink font-medium">{title}</h2>
        {aside !== undefined && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The page-level building blocks every screen shares. They are small on
 * purpose: a `ListPage` / `DetailPage` component that owned the whole
 * composition would have to know about filters, tables and tabs, and every
 * screen that differed slightly would fight it. Screens compose these three
 * instead — see the component showcase for the four standard arrangements.
 */

/** The page gutter and the vertical rhythm. Every screen starts with one. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('page-x pb-16', className)}>{children}</div>
}

export function PageHeader({
  title,
  description,
  actions,
  /** Rendered above the title — breadcrumbs or a back link. */
  above,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  above?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-end gap-x-5 gap-y-2 pt-8 pb-5', className)}>
      {/* The 20rem basis makes the actions wrap below the title on a narrow
          screen instead of squeezing the description to a word per line. */}
      <div className="min-w-0 grow basis-80">
        {above !== undefined && <div className="mb-2">{above}</div>}
        <h1 className="text-ink text-[clamp(24px,3vw,32px)] leading-none font-semibold">{title}</h1>
        {description !== undefined && <p className="text-meta text-n500 mt-2 leading-snug">{description}</p>}
      </div>
      {actions !== undefined && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/**
 * Search and filters above a table. The controls are the screen's — this only
 * lays them out and offers the reset, because "what can be filtered" is a
 * feature decision.
 */
export function FilterBar({
  search,
  children,
  onReset,
  /** Right-hand side: export, bulk actions, a view switch. */
  actions,
  className,
}: {
  search?: ReactNode
  children?: ReactNode
  onReset?: () => void
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 py-3', className)}>
      {search !== undefined && <div className="min-w-[220px] flex-1 sm:max-w-xs">{search}</div>}
      {children}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="h-control-sm text-micro text-brand-deep hover:text-ink px-2"
        >
          Reset
        </button>
      )}
      {actions !== undefined && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A one-line breadcrumb trail. Kept separate so a screen can skip it. */
export function Breadcrumbs({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className="text-micro text-n500 flex items-center gap-1.5">
      {children}
    </nav>
  )
}

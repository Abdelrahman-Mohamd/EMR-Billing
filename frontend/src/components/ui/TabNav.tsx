import type { ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils/cn'

/**
 * The tab strip on a list or a detail screen.
 *
 * These are **links**, not ARIA tabs: each one is a URL, so it can be
 * bookmarked, opened in a new tab and restored on reload. Marking them up as
 * a `tablist` would tell a screen-reader user they switch panels in place,
 * which would be a lie, and would swallow the browser's own navigation
 * behaviour.
 *
 * A real in-page tab set (panels that swap without a URL change) is a
 * different component, and none of the approved screens needs one yet.
 */
export interface TabItem {
  label: string
  /** Any props the router `Link` accepts: `to`, `params`, `search`. */
  link: LinkProps
  /** A number beside the label. `tone` colours an alerting count. */
  count?: number
  countTone?: 'default' | 'alert'
}

export function TabNav({
  items,
  label = 'Sections',
  actions,
  className,
}: {
  items: readonly TabItem[]
  /** Names the group for screen readers, e.g. "Claim sections". */
  label?: string
  /** Buttons pinned to the right of the strip. */
  actions?: ReactNode
  className?: string
}) {
  return (
    <nav
      aria-label={label}
      className={cn('border-rule-structural flex flex-wrap items-end gap-1 border-b', className)}
    >
      <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
        {items.map((item) => (
          <Link
            key={item.label}
            {...item.link}
            // The router sets aria-current="page" on the active link itself.
            activeProps={{
              className: 'font-medium text-brand-deep shadow-[inset_0_-2px_0_var(--color-brand)]',
            }}
            inactiveProps={{ className: 'text-n500 hover:text-ink' }}
            className="text-meta flex flex-none items-center gap-1.5 px-3 pt-3.5 pb-2.5 whitespace-nowrap no-underline"
          >
            {item.label}
            {/* The space keeps "Resolved 3" two words for a screen reader; a flex row does not draw it. */}
            {item.count !== undefined && ' '}
            {item.count !== undefined && (
              <span className={cn('text-micro', item.countTone === 'alert' ? 'text-critical' : 'text-n500')}>
                {item.count}
              </span>
            )}
          </Link>
        ))}
      </div>
      {actions !== undefined && <div className="ml-auto flex items-center gap-2 py-1.5">{actions}</div>}
    </nav>
  )
}

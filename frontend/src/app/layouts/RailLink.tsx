import type { ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils/cn'

export interface NavItem {
  label: string
  icon: ReactNode
  link: LinkProps
  /** A count beside the label, e.g. items waiting in a queue. */
  count?: number
  /** Draws attention to the count. */
  alert?: boolean
  /**
   * Sub-sections, listed under the item where there is room to show them —
   * the phone's navigation drawer (the desktop has the module's own list).
   */
  children?: readonly NavItem[]
}

export interface NavGroup {
  /** Shown above the group when the rail is open. */
  label?: string
  items: readonly NavItem[]
}

/**
 * One navigation link on the brand rail — the desktop rail and the phone's
 * drawer alike. Collapsed, only its icon shows and the label becomes a tip.
 */
export function RailLink({
  item,
  expanded,
  nested = false,
  onNavigate,
}: {
  item: NavItem
  expanded: boolean
  /** A sub-section under its module, indented. */
  nested?: boolean
  /** Called when the link is followed — the drawer closes itself with it. */
  onNavigate?: () => void
}) {
  return (
    <Link
      {...item.link}
      {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
      // Collapsed, the icon carries no text: the name goes into
      // the accessibility tree, and `data-tip` draws the visible
      // label on hover and on keyboard focus (styles/index.css).
      aria-label={expanded ? undefined : item.label}
      data-tip={expanded ? undefined : item.label}
      activeProps={{ className: 'bg-white/20 text-white' }}
      inactiveProps={{ className: 'text-white/[0.78] hover:bg-white/10 hover:text-white' }}
      className={cn(
        'flex flex-none items-center rounded-md no-underline outline-offset-[-2px] focus-visible:outline-white',
        expanded ? 'gap-3 px-3' : 'nav-tip w-11 justify-center',
        nested ? 'h-10 pl-9' : 'h-11 md:h-10',
      )}
    >
      <span aria-hidden="true" className="flex-none">
        {item.icon}
      </span>
      {expanded && <span className="text-meta truncate">{item.label}</span>}
      {expanded && item.count !== undefined && (
        <span className={cn('text-micro ml-auto', item.alert === true ? 'text-sand' : 'text-white/60')}>
          {item.count}
        </span>
      )}
    </Link>
  )
}

import { useState, type ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import logoUrl from '@/assets/logo.png'
import { cn } from '@/lib/utils/cn'

/**
 * The application chrome: a collapsible icon rail on the left, the screen on
 * the right. (Toasts are mounted once, at the root, so sign-in has them too.)
 *
 * It renders the navigation it is given. It does not know which modules exist,
 * and it does not decide who may see them — a feature or the router filters
 * the list before it arrives here (docs/FRONTEND_ARCHITECTURE.md §8).
 */
export interface NavItem {
  label: string
  icon: ReactNode
  link: LinkProps
  /** A count beside the label, e.g. items waiting in a queue. */
  count?: number
  /** Draws attention to the count. */
  alert?: boolean
}

export interface NavGroup {
  /** Shown above the group when the rail is open. */
  label?: string
  items: readonly NavItem[]
}

export function AppShell({
  groups,
  /**
   * Bottom of the rail: the account button (and, later, the practice
   * switcher). A function, so it can lay itself out for the open or the
   * collapsed rail.
   */
  railFooter,
  children,
}: {
  groups: readonly NavGroup[]
  railFooter?: (rail: { expanded: boolean }) => ReactNode
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-canvas flex h-dvh overflow-hidden">
      <nav
        aria-label="Main"
        className={cn(
          'bg-brand relative z-30 flex h-full flex-none flex-col p-3 transition-[width] duration-150',
          expanded ? 'w-rail-open' : 'w-rail',
        )}
      >
        {/*
          The lockup reads "EMR Billing": the mark, with the product word under
          it in the same white. One shape in both rail states, start-aligned, so
          the logo, the icons and the labels share a left edge.
        */}
        <Link
          to="/"
          aria-label="EMR Billing — home"
          className="mb-1.5 flex flex-col items-start gap-0.5 rounded-md py-2"
        >
          {/* A dark PNG; on the brand rail it is flipped to white. */}
          <img
            src={logoUrl}
            alt=""
            className={cn('h-auto brightness-0 invert', expanded ? 'w-28' : 'w-11')}
          />
          <span
            className={cn(
              // Part of the logotype, not body text, so it tracks the mark's
              // width rather than the type scale.
              'leading-none font-medium text-white/85',
              expanded ? 'text-[15px] tracking-wide' : 'text-[11px]',
            )}
          >
            Billing
          </span>
        </Link>

        {/*
          Collapsed, this list must not be a scroll container: a scroll container
          clips the label each icon shows on hover and on focus. Expanded, the
          labels are inside the rail already, so scrolling costs nothing.
        */}
        <div
          className={cn(
            'mt-4 flex min-h-0 flex-1 flex-col gap-1',
            expanded ? 'overflow-y-auto' : 'overflow-visible',
          )}
        >
          {groups.map((group, index) => (
            <div key={group.label ?? index} className="flex flex-col gap-1">
              {group.label !== undefined && expanded && (
                <p className="text-eyebrow mt-3 px-3 pb-1 font-medium text-white/45 uppercase">
                  {group.label}
                </p>
              )}
              {group.label !== undefined && !expanded && index > 0 && <hr className="my-2 border-white/15" />}
              {group.items.map((item) => (
                <RailLink key={item.label} item={item} expanded={expanded} />
              ))}
            </div>
          ))}
        </div>

        {railFooter !== undefined && (
          <div className="mt-2 flex flex-col gap-2 border-t border-white/15 pt-3">
            {railFooter({ expanded })}
          </div>
        )}

        {/*
          The handle sits on the rail's edge, half in and half out, vertically
          centred — the same affordance as the prototype, so the rail always
          shows one obvious way to widen it.
        */}
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse the sidebar' : 'Expand the sidebar'}
          className="border-rule-structural bg-canvas text-n600 hover:border-brand hover:text-brand absolute top-1/2 -right-3 z-40 grid size-6 -translate-y-1/2 place-items-center rounded-full border"
        >
          {expanded ? (
            <ChevronLeft size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </button>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

/** One rail link. Collapsed, only its icon shows and the label becomes a tip. */
function RailLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  return (
    <Link
      {...item.link}
      // Collapsed, the icon carries no text: the name goes into
      // the accessibility tree, and `data-tip` draws the visible
      // label on hover and on keyboard focus (styles/index.css).
      aria-label={expanded ? undefined : item.label}
      data-tip={expanded ? undefined : item.label}
      activeProps={{ className: 'bg-white/20 text-white' }}
      inactiveProps={{ className: 'text-white/[0.78] hover:bg-white/10 hover:text-white' }}
      className={cn(
        'flex h-10 flex-none items-center rounded-md no-underline outline-offset-[-2px] focus-visible:outline-white',
        expanded ? 'gap-3 px-3' : 'nav-tip w-11 justify-center',
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

import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import logoUrl from '@/assets/logo.png'
import { DESKTOP_NAV_QUERY, useMediaQuery } from '@/lib/hooks/use-media-query'
import { cn } from '@/lib/utils/cn'
import { MobileBar } from './MobileNav'
import { RailLink, type NavGroup } from './RailLink'

export type { NavGroup, NavItem } from './RailLink'

/**
 * The application chrome. From 768px: a collapsible icon rail on the left,
 * the screen on the right. Below 768px (the prototype's phone breakpoint):
 * a brand bar across the top and the rail as a slide-in drawer (MobileBar).
 * Only one of the two is ever rendered. (Toasts are mounted once, at the
 * root, so sign-in has them too.)
 *
 * It renders the navigation it is given. It does not know which modules exist,
 * and it does not decide who may see them — a feature or the router filters
 * the list before it arrives here (docs/FRONTEND_ARCHITECTURE.md §8).
 */
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
  railFooter?: (rail: { expanded: boolean; placement: 'rail' | 'bar' }) => ReactNode
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const desktop = useMediaQuery(DESKTOP_NAV_QUERY)

  if (!desktop) {
    return (
      <div className="bg-canvas flex h-dvh flex-col overflow-hidden">
        <MobileBar
          groups={groups}
          {...(railFooter === undefined
            ? {}
            : { account: railFooter({ expanded: false, placement: 'bar' }) })}
        />
        {/* `relative`: the scroll area is the containing block for anything
            absolutely positioned inside a page — an `sr-only` label above
            all. Without it such an element is placed against the document,
            at its spot deep in the scrolled content, and stretches the
            document: a second scrollbar beside this one. */}
        <main className="relative min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    )
  }

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
            {railFooter({ expanded, placement: 'rail' })}
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
          className="border-rule-structural bg-canvas text-n600 hover:border-brand hover:text-brand absolute top-1/2 -right-3 z-40 grid size-6 -translate-y-1/2 place-items-center rounded-full border after:absolute after:-inset-2.5 after:content-['']"
        >
          {expanded ? (
            <ChevronLeft size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* `relative`: the scroll area is the containing block for anything
            absolutely positioned inside a page — an `sr-only` label above
            all. Without it such an element is placed against the document,
            at its spot deep in the scrolled content, and stretches the
            document: a second scrollbar beside this one. */}
      <main className="relative min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

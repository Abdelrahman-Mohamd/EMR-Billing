import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { NavItem } from './RailLink'

export interface SectionGroup {
  label: string
  items: readonly NavItem[]
}

/**
 * A module made of sections — Admin, Setup — with the section list beside the
 * screen, as in the prototype: a sticky column from 1024px, a row of pills
 * from 768px. On a phone the sections are in the navigation drawer, under
 * their module, so the row is not repeated there.
 *
 * Each module defines its sections once (`admin-sections.tsx`,
 * `setup-sections.tsx`) for this list and the drawer alike.
 */
export function SectionLayout({
  label,
  groups,
  children,
}: {
  /** Names the section list for assistive technology: "Admin", "Setup". */
  label: string
  groups: readonly SectionGroup[]
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* From 1024px the list stays put like the rail: sticky at the top of
          the page's scroll area, one screen tall, scrolling on its own only if
          it is ever longer than the screen. */}
      <nav
        aria-label={label}
        className="border-rule-structural bg-canvas hidden flex-none gap-1 overflow-x-auto border-b px-4 py-2.5 md:flex lg:sticky lg:top-0 lg:h-dvh lg:w-[248px] lg:flex-col lg:self-start lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-3 lg:pt-4 lg:pb-6"
      >
        {groups.map((group) => (
          // `contents` below lg: the groups flatten into one scrolling row.
          <div key={group.label} className="contents lg:flex lg:flex-col lg:gap-0.5">
            <p className="text-eyebrow text-n500 mt-1 mb-1.5 hidden px-3 font-medium uppercase lg:block">
              {group.label}
            </p>
            {group.items.map((section) => (
              <Link
                key={section.label}
                {...section.link}
                activeProps={{ className: 'bg-brand-wash text-brand-deep font-medium [&_svg]:text-brand' }}
                inactiveProps={{ className: 'text-n600 hover:bg-n50 hover:text-ink [&_svg]:text-n400' }}
                className="text-meta flex h-[38px] flex-none items-center gap-2.5 rounded-full px-3 whitespace-nowrap no-underline"
              >
                <span aria-hidden="true" className="flex-none">
                  {section.icon}
                </span>
                {section.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { Building2, Layers, UserRound, Users } from 'lucide-react'

/**
 * The Admin area: a section list beside the screen, as in the prototype — a
 * column at desktop width, a scrolling row of pills below 1024px.
 *
 * Like the main rail, it lists only sections that exist. The prototype's other
 * Admin sections (Users, Providers, Insurances …) are
 * added here as each one is built, into the groups the prototype uses:
 * Organization, Setup, Billing rules, Audit.
 */
interface AdminSection {
  label: string
  icon: ReactNode
  link: LinkProps
}

const GROUPS: ReadonlyArray<{ label: string; sections: readonly AdminSection[] }> = [
  {
    label: 'Organization',
    sections: [
      { label: 'Organizations', icon: <Layers size={18} />, link: { to: '/admin/organizations' } },
      { label: 'Practices & locations', icon: <Building2 size={18} />, link: { to: '/admin/practices' } },
      { label: 'Users', icon: <Users size={18} />, link: { to: '/admin/users' } },
    ],
  },
  {
    label: 'Setup',
    sections: [
      {
        label: 'Referring physicians',
        icon: <UserRound size={18} />,
        link: { to: '/admin/referring-physicians' },
      },
    ],
  },
]

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <nav
        aria-label="Admin"
        className="border-rule-structural bg-canvas flex flex-none gap-1 overflow-x-auto border-b px-4 py-2.5 lg:w-[248px] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-3 lg:pt-4 lg:pb-6"
      >
        {GROUPS.map((group) => (
          // `contents` below lg: the groups flatten into one scrolling row.
          <div key={group.label} className="contents lg:flex lg:flex-col lg:gap-0.5">
            <p className="text-eyebrow text-n500 mt-1 mb-1.5 hidden px-3 font-medium uppercase lg:block">
              {group.label}
            </p>
            {group.sections.map((section) => (
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

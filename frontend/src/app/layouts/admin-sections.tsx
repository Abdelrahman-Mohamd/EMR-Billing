import { Building2, Layers, UserRound, Users } from 'lucide-react'
import type { NavItem } from './RailLink'

/**
 * The Admin sections, in the prototype's groups (Organization, Setup, Billing
 * rules, Audit) — one definition for every place that lists them: the Admin
 * section list beside the screen and, on a phone, the navigation drawer.
 *
 * Only sections that exist are listed; each new Admin screen adds its entry
 * here.
 */
export const ADMIN_SECTION_GROUPS: ReadonlyArray<{ label: string; items: readonly NavItem[] }> = [
  {
    label: 'Organization',
    items: [
      { label: 'Organizations', icon: <Layers size={18} />, link: { to: '/admin/organizations' } },
      { label: 'Practices & locations', icon: <Building2 size={18} />, link: { to: '/admin/practices' } },
      { label: 'Users', icon: <Users size={18} />, link: { to: '/admin/users' } },
    ],
  },
  {
    label: 'Setup',
    items: [
      {
        label: 'Referring physicians',
        icon: <UserRound size={18} />,
        link: { to: '/admin/referring-physicians' },
      },
    ],
  },
]

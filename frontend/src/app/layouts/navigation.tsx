import { Settings, SlidersHorizontal, TriangleAlert, Users } from 'lucide-react'
import { ADMIN_SECTION_GROUPS } from './admin-sections'
import { SETUP_SECTION_GROUPS } from './setup-sections'
import type { NavGroup } from './RailLink'

/**
 * What the rail shows. It lists the routes that exist — nothing else.
 *
 * As each module is built (Patients, Charges, Claims, Admin …) it adds its
 * entry here, so the navigation can never link to a screen that has not been
 * written. Permission filtering happens here too, once the permission model
 * exists (docs/FRONTEND_ARCHITECTURE.md §8).
 */
export function navigationGroups(): NavGroup[] {
  const groups: NavGroup[] = [
    {
      // The modules people work in, in the prototype's order. "/" itself is
      // not listed: it opens Patients (routes/_app/index.tsx).
      items: [
        { label: 'Patients', icon: <Users size={18} />, link: { to: '/patients' } },
        { label: 'Exceptions', icon: <TriangleAlert size={18} />, link: { to: '/exceptions' } },
      ],
    },
    {
      // Lit for every /setup/* and /admin/* screen. Their sections are listed
      // under them where there is room (the phone's drawer); on a wider screen
      // each area shows them itself. Setup stands beside Admin (client,
      // 2026-09-30), in the prototype's order: Setup, then Admin.
      items: [
        {
          label: 'Setup',
          icon: <SlidersHorizontal size={18} />,
          link: { to: '/setup' },
          children: SETUP_SECTION_GROUPS.flatMap((group) => group.items),
        },
        {
          label: 'Admin',
          icon: <Settings size={18} />,
          link: { to: '/admin' },
          children: ADMIN_SECTION_GROUPS.flatMap((group) => group.items),
        },
      ],
    },
  ]

  // The component showcase (/dev/ui) is a developer tool: reached by its
  // address in development, never listed here.
  return groups
}

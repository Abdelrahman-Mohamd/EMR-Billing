import { Home, LayoutGrid, Settings } from 'lucide-react'
import { ADMIN_SECTION_GROUPS } from './admin-sections'
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
      // `exact`: every path starts with "/", so without it Home would be lit
      // on every screen.
      items: [{ label: 'Home', icon: <Home size={18} />, link: { to: '/', activeOptions: { exact: true } } }],
    },
    {
      // Lit for every /admin/* screen. Its sections are listed under it where
      // there is room (the phone's drawer); on a wider screen the Admin area
      // shows them itself.
      items: [
        {
          label: 'Admin',
          icon: <Settings size={18} />,
          link: { to: '/admin' },
          children: ADMIN_SECTION_GROUPS.flatMap((group) => group.items),
        },
      ],
    },
  ]

  if (import.meta.env.DEV) {
    groups.push({
      label: 'Development',
      items: [{ label: 'Components', icon: <LayoutGrid size={18} />, link: { to: '/dev/ui' } }],
    })
  }

  return groups
}

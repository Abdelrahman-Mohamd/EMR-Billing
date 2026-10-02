import { Building2, Clock, GitBranch, History, Layers, Lock, Plug, Users } from 'lucide-react'
import type { SectionGroup } from './SectionLayout'

/**
 * The Admin sections, in the prototype's groups (Organization, Billing rules,
 * Audit) — one definition for every place that lists them: the Admin section
 * list beside the screen and, on a phone, the navigation drawer.
 *
 * Setup is not here: the client moved it out of Admin into its own module on
 * 2026-09-30 (`setup-sections.tsx`).
 *
 * Only sections that exist are listed; each new Admin screen adds its entry
 * here.
 */
export const ADMIN_SECTION_GROUPS: readonly SectionGroup[] = [
  {
    label: 'Organization',
    items: [
      { label: 'Organizations', icon: <Layers size={18} />, link: { to: '/admin/organizations' } },
      { label: 'Practices & locations', icon: <Building2 size={18} />, link: { to: '/admin/practices' } },
      { label: 'Users', icon: <Users size={18} />, link: { to: '/admin/users' } },
      { label: 'Roles & permissions', icon: <Lock size={18} />, link: { to: '/admin/roles' } },
      { label: 'EMR integration', icon: <Plug size={18} />, link: { to: '/admin/integration' } },
    ],
  },
  {
    label: 'Billing rules',
    items: [
      { label: 'Coding rules', icon: <GitBranch size={18} />, link: { to: '/admin/coding-rules' } },
      { label: 'Submission & automation', icon: <Clock size={18} />, link: { to: '/admin/automation' } },
    ],
  },
  {
    label: 'Audit',
    items: [{ label: 'Audit log', icon: <History size={18} />, link: { to: '/admin/audit' } }],
  },
]

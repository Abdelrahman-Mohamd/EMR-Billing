import { DollarSign, Hash, Inbox, Landmark, Layers, Stethoscope, UserRound } from 'lucide-react'
import type { SectionGroup } from './SectionLayout'

/**
 * The Setup sections: the master data claims are built from. Setup is its own
 * module beside Admin, not a group inside it (client, 2026-09-30).
 *
 * Listed in the prototype's order. Only sections that exist are listed; each
 * new Setup screen adds its entry here.
 */
export const SETUP_SECTION_GROUPS: readonly SectionGroup[] = [
  {
    label: 'Setup',
    items: [
      { label: 'Providers', icon: <Stethoscope size={18} />, link: { to: '/setup/providers' } },
      { label: 'Insurance classes', icon: <Layers size={18} />, link: { to: '/setup/insurance-classes' } },
      { label: 'Insurances', icon: <Landmark size={18} />, link: { to: '/setup/insurances' } },
      { label: 'Release buckets', icon: <Inbox size={18} />, link: { to: '/setup/release-buckets' } },
      { label: 'Procedure codes', icon: <Hash size={18} />, link: { to: '/setup/procedure-codes' } },
      { label: 'Fee schedules', icon: <DollarSign size={18} />, link: { to: '/setup/fee-schedules' } },
      {
        label: 'Referring physicians',
        icon: <UserRound size={18} />,
        link: { to: '/setup/referring-physicians' },
      },
    ],
  },
]

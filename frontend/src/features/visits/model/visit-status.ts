import type { Tone } from '@/components/ui/Badge'
import type { Visit } from '../schemas/visit'

const STATUS: Readonly<Record<string, { label: string; tone: Tone }>> = {
  review: { label: 'In review', tone: 'info' },
  pended: { label: 'Pended', tone: 'warning' },
  released: { label: 'Released', tone: 'success' },
}

/** The server's status in words: In review, Pended, Released — or the server's own word. */
export function visitStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: status.charAt(0).toUpperCase() + status.slice(1), tone: 'inert' }
}

/** A released visit can no longer change: the server refuses edit, release and delete. */
export const isReleased = (visit: Pick<Visit, 'status'>) => visit.status === 'released'
